use std::sync::Arc;
use std::time::Instant;

use futures::future::join_all;
use rusqlite::Connection;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::ai::coordinator::Coordinator;
use crate::ai::memory::MemoryManager;
use crate::ai::planner::Planner;
use crate::ai::router::ToolRouter;
use crate::ai::types::*;
use crate::error::AppError;
use crate::mcp::manager::McpManager;

// ---------------------------------------------------------------------------
// Executor — runs plan steps, observes results, self-heals on failure
// ---------------------------------------------------------------------------

pub struct Executor;

/// Emit a BrainEvent to the frontend via the Tauri event system.
fn emit_event(app_handle: Option<&AppHandle>, event: BrainEvent) {
    if let Some(handle) = app_handle {
        let _ = handle.emit("brain-event", &event);
    }
}

impl Executor {
    /// Execute all steps in a plan, returning the synthesised final result.
    ///
    /// Independent `ToolCall` steps that are ready at the same time are executed
    /// **in parallel** using `futures::future::join_all`.  LLM / Synthesize /
    /// Shell / Conditional steps are executed sequentially because they need
    /// mutable access to the coordinator or have ordering constraints.
    pub async fn execute_plan(
        plan: &mut AgentPlan,
        coordinator: &mut Coordinator,
        tool_router: &ToolRouter,
        memory: &mut MemoryManager,
        mcp_manager: &Arc<Mutex<McpManager>>,
        db: &Arc<std::sync::Mutex<Connection>>,
        app_handle: Option<&AppHandle>,
    ) -> Result<String, AppError> {
        let goal_id = plan.goal_id.clone();
        let max_iterations = 100;
        let mut iteration = 0;

        loop {
            iteration += 1;
            if iteration > max_iterations {
                return Err(AppError::ai("Execution loop exceeded maximum iterations"));
            }

            if Planner::is_complete(plan) {
                break;
            }

            if Planner::has_unrecoverable_failure(plan) {
                return Err(AppError::ai(
                    "Plan has unrecoverable failures — all retries exhausted",
                ));
            }

            let ready_step_ids = Planner::next_ready_steps(plan);
            if ready_step_ids.is_empty() {
                return Err(AppError::ai(
                    "No steps ready to execute but plan is not complete — possible circular dependency",
                ));
            }

            // Partition: ToolCall steps → parallel; everything else → sequential
            let (parallel_ids, sequential_ids): (Vec<u32>, Vec<u32>) =
                ready_step_ids.into_iter().partition(|&id| {
                    plan.steps
                        .iter()
                        .find(|s| s.id == id)
                        .map(|s| matches!(s.action, StepAction::ToolCall { .. }))
                        .unwrap_or(false)
                });

            // ------------------------------------------------------------------
            // Parallel ToolCall execution
            // ------------------------------------------------------------------
            if !parallel_ids.is_empty() {
                // Mark all as running
                for &step_id in &parallel_ids {
                    if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
                        step.status = StepStatus::Running;
                    }
                    let desc = plan
                        .steps
                        .iter()
                        .find(|s| s.id == step_id)
                        .map(|s| s.description.clone())
                        .unwrap_or_default();
                    emit_event(app_handle, BrainEvent::StepStarted {
                        goal_id: goal_id.clone(),
                        step_id,
                        description: desc,
                    });
                }

                // Clone steps and a snapshot of the plan for the async closures
                let step_clones: Vec<PlanStep> = parallel_ids
                    .iter()
                    .filter_map(|&id| plan.steps.iter().find(|s| s.id == id).cloned())
                    .collect();
                let plan_snap = plan.clone();

                // Build one future per ToolCall step
                let futs: Vec<_> = step_clones
                    .iter()
                    .map(|step| {
                        Self::execute_tool_step_owned(step.clone(), plan_snap.clone(), tool_router, mcp_manager)
                    })
                    .collect();

                let results = join_all(futs).await;

                // Apply results
                for (step_clone, result) in step_clones.iter().zip(results.into_iter()) {
                    Self::apply_step_result(
                        plan,
                        step_clone.id,
                        step_clone,
                        result,
                        memory,
                        db,
                        &goal_id,
                        app_handle,
                    );
                }

                // Emit aggregate progress
                let completed = plan
                    .steps
                    .iter()
                    .filter(|s| {
                        s.status == StepStatus::Completed || s.status == StepStatus::Skipped
                    })
                    .count();
                emit_event(app_handle, BrainEvent::Progress {
                    goal_id: goal_id.clone(),
                    completed_steps: completed,
                    total_steps: plan.steps.len(),
                    current_step: None,
                });
            }

            // ------------------------------------------------------------------
            // Sequential execution for LLM / Synthesize / Shell / Conditional
            // ------------------------------------------------------------------
            for step_id in sequential_ids {
                let step_description = plan
                    .steps
                    .iter()
                    .find(|s| s.id == step_id)
                    .map(|s| s.description.clone())
                    .unwrap_or_default();

                if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
                    step.status = StepStatus::Running;
                }

                emit_event(app_handle, BrainEvent::StepStarted {
                    goal_id: goal_id.clone(),
                    step_id,
                    description: step_description.clone(),
                });

                let completed = plan
                    .steps
                    .iter()
                    .filter(|s| {
                        s.status == StepStatus::Completed || s.status == StepStatus::Skipped
                    })
                    .count();
                emit_event(app_handle, BrainEvent::Progress {
                    goal_id: goal_id.clone(),
                    completed_steps: completed,
                    total_steps: plan.steps.len(),
                    current_step: Some(step_description),
                });

                let step_clone = plan.steps.iter().find(|s| s.id == step_id).unwrap().clone();

                let result = Self::execute_step(
                    &step_clone,
                    plan,
                    coordinator,
                    tool_router,
                    mcp_manager,
                    db,
                )
                .await;

                Self::apply_step_result(
                    plan, step_id, &step_clone, result, memory, db, &goal_id, app_handle,
                );
            }
        }

        let final_output = Self::synthesize_result(plan);
        Ok(final_output)
    }

    // -----------------------------------------------------------------------
    // Parallel-safe ToolCall executor (takes ownership of step + plan snapshot)
    // -----------------------------------------------------------------------

    async fn execute_tool_step_owned(
        step: PlanStep,
        _plan: AgentPlan,
        tool_router: &ToolRouter,
        mcp_manager: &Arc<Mutex<McpManager>>,
    ) -> Result<StepResult, AppError> {
        let start = Instant::now();
        match &step.action {
            StepAction::ToolCall { tool_name, arguments } => {
                let result = tool_router
                    .execute_tool(mcp_manager, tool_name, arguments.clone())
                    .await;
                let duration_ms = start.elapsed().as_millis() as u64;

                if result.success {
                    Ok(StepResult {
                        output: result.output,
                        success: true,
                        error: None,
                        duration_ms,
                        metadata: Some(json!({
                            "tool_name": tool_name,
                            "server_id": result.server_id,
                        })),
                    })
                } else {
                    Err(AppError::ai(format!(
                        "Tool '{}' failed: {}",
                        tool_name,
                        result.error.unwrap_or_else(|| "Unknown error".to_string())
                    )))
                }
            }
            _ => Err(AppError::ai("execute_tool_step_owned called on non-ToolCall step")),
        }
    }

    // -----------------------------------------------------------------------
    // Apply a step result back to the plan (update status, learn, log, emit)
    // -----------------------------------------------------------------------

    fn apply_step_result(
        plan: &mut AgentPlan,
        step_id: u32,
        _step_clone: &PlanStep,
        result: Result<StepResult, AppError>,
        memory: &mut MemoryManager,
        db: &Arc<std::sync::Mutex<Connection>>,
        goal_id: &str,
        app_handle: Option<&AppHandle>,
    ) {
        match result {
            Ok(step_result) => {
                let output_preview = step_result.output.chars().take(200).collect::<String>();

                if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
                    step.status = StepStatus::Completed;
                    step.result = Some(step_result.clone());
                    Self::learn_from_success(step, &step_result, memory);
                    Self::log_execution(db, goal_id, step_id, step, &step_result);
                }

                emit_event(app_handle, BrainEvent::StepCompleted {
                    goal_id: goal_id.to_string(),
                    step_id,
                    success: true,
                    output_preview,
                });
            }
            Err(error) => {
                let healed = {
                    if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
                        Self::attempt_healing(step, &error, app_handle, goal_id)
                    } else {
                        false
                    }
                };

                if !healed {
                    if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
                        step.status = StepStatus::Failed;
                        step.result = Some(StepResult {
                            output: String::new(),
                            success: false,
                            error: Some(error.to_string()),
                            duration_ms: 0,
                            metadata: None,
                        });
                        Self::learn_from_failure(step, &error.to_string(), memory);
                    }

                    emit_event(app_handle, BrainEvent::StepCompleted {
                        goal_id: goal_id.to_string(),
                        step_id,
                        success: false,
                        output_preview: error.to_string(),
                    });
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Step Execution (sequential — needs mutable coordinator)
    // -----------------------------------------------------------------------

    async fn execute_step(
        step: &PlanStep,
        plan: &AgentPlan,
        coordinator: &mut Coordinator,
        tool_router: &ToolRouter,
        mcp_manager: &Arc<Mutex<McpManager>>,
        _db: &Arc<std::sync::Mutex<Connection>>,
    ) -> Result<StepResult, AppError> {
        let start = Instant::now();

        match &step.action {
            StepAction::ToolCall {
                tool_name,
                arguments,
            } => {
                let result = tool_router
                    .execute_tool(mcp_manager, tool_name, arguments.clone())
                    .await;

                let duration_ms = start.elapsed().as_millis() as u64;

                if result.success {
                    Ok(StepResult {
                        output: result.output,
                        success: true,
                        error: None,
                        duration_ms,
                        metadata: Some(json!({
                            "tool_name": tool_name,
                            "server_id": result.server_id,
                        })),
                    })
                } else {
                    Err(AppError::ai(format!(
                        "Tool '{}' failed: {}",
                        tool_name,
                        result.error.unwrap_or_else(|| "Unknown error".to_string())
                    )))
                }
            }

            StepAction::LlmQuery {
                prompt,
                system_prompt,
                preferred_provider,
            } => {
                let context = Self::build_step_context(step, plan);

                let mut messages = Vec::new();

                if let Some(sys) = system_prompt {
                    messages.push(LlmMessage {
                        role: "system".to_string(),
                        content: sys.clone(),
                    });
                }

                let full_prompt = if context.is_empty() {
                    prompt.clone()
                } else {
                    format!(
                        "{}\n\nContext from previous steps:\n{}",
                        prompt, context
                    )
                };

                messages.push(LlmMessage {
                    role: "user".to_string(),
                    content: full_prompt,
                });

                let request = LlmRequest {
                    messages,
                    tools: None,
                    temperature: Some(0.7),
                    max_tokens: None,
                    task_type: TaskType::Reasoning,
                    force_provider: preferred_provider.clone(),
                };

                let response = coordinator.route_request(&request).await?;
                let duration_ms = start.elapsed().as_millis() as u64;

                Ok(StepResult {
                    output: response.content,
                    success: true,
                    error: None,
                    duration_ms,
                    metadata: Some(json!({
                        "provider": response.provider_used,
                        "model": response.model_used,
                        "tokens": response.tokens_used,
                    })),
                })
            }

            StepAction::Synthesize {
                step_ids,
                instruction,
            } => {
                let outputs = Planner::collect_outputs(plan, step_ids);
                let mut context = String::new();
                for (id, output) in &outputs {
                    context.push_str(&format!("## Step {} Output\n{}\n\n", id, output));
                }

                let messages = vec![
                    LlmMessage {
                        role: "system".to_string(),
                        content: "You are a synthesis agent. Combine the provided step outputs into a coherent, useful response following the given instruction.".to_string(),
                    },
                    LlmMessage {
                        role: "user".to_string(),
                        content: format!(
                            "Instruction: {}\n\nStep outputs:\n{}",
                            instruction, context
                        ),
                    },
                ];

                let request = LlmRequest {
                    messages,
                    tools: None,
                    temperature: Some(0.5),
                    max_tokens: None,
                    task_type: TaskType::Simple,
                    force_provider: None,
                };

                let response = coordinator.route_request(&request).await?;
                let duration_ms = start.elapsed().as_millis() as u64;

                Ok(StepResult {
                    output: response.content,
                    success: true,
                    error: None,
                    duration_ms,
                    metadata: Some(json!({
                        "synthesized_from": step_ids,
                    })),
                })
            }

            StepAction::ShellCommand { command, args } => {
                let allowed = [
                    "echo", "cat", "ls", "pwd", "date", "whoami", "node", "npm", "npx",
                    "cargo", "git", "python", "python3",
                ];
                let base_cmd = command.split('/').last().unwrap_or(command);
                if !allowed.iter().any(|a| *a == base_cmd) {
                    return Err(AppError::ai(format!(
                        "Shell command '{}' is not in the allowed list",
                        command
                    )));
                }

                let output = tokio::process::Command::new(command)
                    .args(args)
                    .output()
                    .await
                    .map_err(|e| {
                        AppError::ai(format!("Failed to execute shell command: {}", e))
                    })?;

                let duration_ms = start.elapsed().as_millis() as u64;
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                if output.status.success() {
                    Ok(StepResult {
                        output: stdout,
                        success: true,
                        error: if stderr.is_empty() { None } else { Some(stderr) },
                        duration_ms,
                        metadata: Some(json!({
                            "command": command,
                            "exit_code": output.status.code(),
                        })),
                    })
                } else {
                    Err(AppError::ai(format!(
                        "Shell command failed (exit {}): {}",
                        output.status.code().unwrap_or(-1),
                        stderr
                    )))
                }
            }

            StepAction::Conditional {
                condition,
                if_true,
                if_false,
            } => {
                let context = Self::build_step_context(step, plan);
                let eval_result = context
                    .to_lowercase()
                    .contains(&condition.to_lowercase());

                let duration_ms = start.elapsed().as_millis() as u64;
                Ok(StepResult {
                    output: format!(
                        "Condition '{}' evaluated to {}. Branch: {:?}",
                        condition,
                        eval_result,
                        if eval_result { if_true } else { if_false }
                    ),
                    success: true,
                    error: None,
                    duration_ms,
                    metadata: Some(json!({
                        "condition": condition,
                        "result": eval_result,
                        "active_branch": if eval_result { if_true } else { if_false },
                        "skipped_branch": if eval_result { if_false } else { if_true },
                    })),
                })
            }
        }
    }

    // -----------------------------------------------------------------------
    // Self-Healer
    // -----------------------------------------------------------------------

    fn attempt_healing(
        step: &mut PlanStep,
        error: &AppError,
        app_handle: Option<&AppHandle>,
        goal_id: &str,
    ) -> bool {
        if step.retries >= step.max_retries {
            return false;
        }

        step.retries += 1;
        step.status = StepStatus::Retrying;

        let error_str = error.to_string();
        let strategy = Self::diagnose_and_select_strategy(&error_str, step);

        emit_event(app_handle, BrainEvent::StepHealing {
            goal_id: goal_id.to_string(),
            step_id: step.id,
            error: error_str.clone(),
            strategy: strategy.name.clone(),
        });

        match strategy.action {
            HealingAction::Retry => {
                tracing::info!(
                    "Healing step {} with Retry (attempt {}/{})",
                    step.id,
                    step.retries,
                    step.max_retries
                );
                step.status = StepStatus::Pending;
                true
            }

            HealingAction::SwitchProvider { ref provider } => {
                tracing::info!(
                    "Healing step {} by switching to provider '{}'",
                    step.id,
                    provider
                );

                if let StepAction::LlmQuery {
                    ref mut preferred_provider,
                    ..
                } = step.action
                {
                    *preferred_provider = Some(provider.clone());
                }

                emit_event(app_handle, BrainEvent::ProviderSwitched {
                    from: "current".to_string(),
                    to: provider.clone(),
                    reason: error_str,
                });

                step.status = StepStatus::Pending;
                true
            }

            HealingAction::Skip { ref reason } => {
                tracing::info!("Healing step {} by skipping: {}", step.id, reason);
                step.status = StepStatus::Skipped;
                step.result = Some(StepResult {
                    output: format!("Skipped: {}", reason),
                    success: true,
                    error: None,
                    duration_ms: 0,
                    metadata: None,
                });
                true
            }

            HealingAction::Reprompt { ref new_prompt } => {
                tracing::info!("Healing step {} with reprompt", step.id);
                if let StepAction::LlmQuery { ref mut prompt, .. } = step.action {
                    *prompt = new_prompt.clone();
                }
                step.status = StepStatus::Pending;
                true
            }

            _ => {
                tracing::info!(
                    "Healing step {} with generic retry strategy: {}",
                    step.id,
                    strategy.name
                );
                step.status = StepStatus::Pending;
                true
            }
        }
    }

    fn diagnose_and_select_strategy(error: &str, step: &PlanStep) -> HealingStrategy {
        let error_lower = error.to_lowercase();

        if error_lower.contains("429")
            || error_lower.contains("rate limit")
            || error_lower.contains("too many requests")
        {
            return HealingStrategy {
                name: "Switch Provider (Rate Limited)".to_string(),
                description: "Rate limited — switching to fallback provider".to_string(),
                action: HealingAction::SwitchProvider {
                    provider: "primary".to_string(),
                },
            };
        }

        if error_lower.contains("timeout") || error_lower.contains("timed out") {
            return HealingStrategy {
                name: "Retry (Timeout)".to_string(),
                description: "Request timed out — retrying".to_string(),
                action: HealingAction::Retry,
            };
        }

        if error_lower.contains("500")
            || error_lower.contains("502")
            || error_lower.contains("503")
            || error_lower.contains("internal server error")
        {
            return HealingStrategy {
                name: "Retry (Server Error)".to_string(),
                description: "Server error — retrying after delay".to_string(),
                action: HealingAction::Retry,
            };
        }

        if error_lower.contains("401")
            || error_lower.contains("403")
            || error_lower.contains("unauthorized")
            || error_lower.contains("forbidden")
        {
            return HealingStrategy {
                name: "Switch Provider (Auth Error)".to_string(),
                description: "Authentication failed — trying different provider".to_string(),
                action: HealingAction::SwitchProvider {
                    provider: "primary".to_string(),
                },
            };
        }

        if error_lower.contains("unknown tool") || error_lower.contains("not found") {
            return HealingStrategy {
                name: "Skip (Tool Not Found)".to_string(),
                description: "Tool not available — skipping step".to_string(),
                action: HealingAction::Skip {
                    reason: format!("Tool not available: {}", error),
                },
            };
        }

        if error_lower.contains("parse") || error_lower.contains("json") {
            return HealingStrategy {
                name: "Reprompt (Parse Error)".to_string(),
                description: "Response was not valid — reprompting with clearer instructions"
                    .to_string(),
                action: HealingAction::Reprompt {
                    new_prompt: format!(
                        "The previous attempt failed with a parsing error. Please try again with a clearer, well-structured response.\n\nOriginal task: {}",
                        step.description
                    ),
                },
            };
        }

        HealingStrategy {
            name: "Retry (Generic)".to_string(),
            description: format!("Unknown error — retrying: {}", error),
            action: HealingAction::Retry,
        }
    }

    // -----------------------------------------------------------------------
    // Observer — Learning
    // -----------------------------------------------------------------------

    fn learn_from_success(step: &PlanStep, result: &StepResult, memory: &mut MemoryManager) {
        match &step.action {
            StepAction::ToolCall { tool_name, .. } => {
                memory.remember_short(
                    format!(
                        "Tool '{}' succeeded for task: {} ({}ms)",
                        tool_name, step.description, result.duration_ms
                    ),
                    vec!["tool_success".to_string(), tool_name.clone()],
                );
            }
            StepAction::LlmQuery { .. } => {
                if let Some(ref meta) = result.metadata {
                    let provider = meta["provider"].as_str().unwrap_or("unknown");
                    memory.remember_short(
                        format!(
                            "LLM query succeeded via {} for: {} ({}ms)",
                            provider, step.description, result.duration_ms
                        ),
                        vec!["llm_success".to_string(), provider.to_string()],
                    );
                }
            }
            _ => {}
        }
    }

    fn learn_from_failure(step: &PlanStep, error: &str, memory: &mut MemoryManager) {
        let action_label = match &step.action {
            StepAction::ToolCall { tool_name, .. } => format!("tool:{}", tool_name),
            StepAction::LlmQuery { .. } => "llm_query".to_string(),
            StepAction::ShellCommand { command, .. } => format!("shell:{}", command),
            _ => "other".to_string(),
        };

        memory.remember_short(
            format!(
                "FAILED [{}] {}: {}",
                action_label, step.description, error
            ),
            vec!["failure".to_string(), action_label],
        );
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn build_step_context(step: &PlanStep, plan: &AgentPlan) -> String {
        let outputs = Planner::collect_outputs(plan, &step.depends_on);
        if outputs.is_empty() {
            return String::new();
        }

        let mut context = String::new();
        for (id, output) in &outputs {
            let desc = plan
                .steps
                .iter()
                .find(|s| s.id == *id)
                .map(|s| s.description.as_str())
                .unwrap_or("Unknown step");
            context.push_str(&format!("### Step {} — {}\n{}\n\n", id, desc, output));
        }
        context
    }

    fn synthesize_result(plan: &AgentPlan) -> String {
        let mut best_output = String::new();

        for step in plan.steps.iter().rev() {
            if step.status == StepStatus::Completed {
                if let Some(ref result) = step.result {
                    if matches!(step.action, StepAction::Synthesize { .. }) {
                        return result.output.clone();
                    }
                    if best_output.is_empty() {
                        best_output = result.output.clone();
                    }
                }
            }
        }

        if best_output.is_empty() {
            "Goal completed but no output was produced.".to_string()
        } else {
            best_output
        }
    }

    fn log_execution(
        db: &Arc<std::sync::Mutex<Connection>>,
        goal_id: &str,
        step_id: u32,
        step: &PlanStep,
        result: &StepResult,
    ) {
        let action_type = match &step.action {
            StepAction::ToolCall { .. } => "tool_call",
            StepAction::LlmQuery { .. } => "llm_query",
            StepAction::Synthesize { .. } => "synthesize",
            StepAction::ShellCommand { .. } => "shell_command",
            StepAction::Conditional { .. } => "conditional",
        };

        if let Ok(conn) = db.lock() {
            let now = chrono::Utc::now().to_rfc3339();
            let status = if result.success { "completed" } else { "failed" };
            let provider = result
                .metadata
                .as_ref()
                .and_then(|m| m["provider"].as_str())
                .map(|s| s.to_string());

            let _ = conn.execute(
                "INSERT INTO brain_execution_log (goal_id, step_id, action_type, description, status, output, error, duration_ms, provider_used, executed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                rusqlite::params![
                    goal_id,
                    step_id,
                    action_type,
                    step.description,
                    status,
                    result.output,
                    result.error,
                    result.duration_ms,
                    provider,
                    now,
                ],
            );
        }
    }
}
