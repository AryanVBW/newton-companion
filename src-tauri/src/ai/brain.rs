use std::sync::Arc;
use std::time::Instant;

use chrono::Utc;
use futures::future::join_all;
use reqwest::Client;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::ai::builtin_tools;
use crate::ai::coordinator::Coordinator;
use crate::ai::executor::Executor;
use crate::ai::memory::MemoryManager;
use crate::ai::planner::Planner;
use crate::ai::providers::{AiConfig, AiProvider};
use crate::ai::router::ToolRouter;
use crate::ai::types::*;
use crate::calendar::google::GoogleCalendarClient;
use crate::error::AppError;
use crate::mcp::manager::McpManager;
use crate::mcp::protocol::McpTool;

/// Emit a BrainEvent to the frontend via the Tauri event system.
fn emit_event(app_handle: Option<&AppHandle>, event: BrainEvent) {
    if let Some(handle) = app_handle {
        let _ = handle.emit("brain-event", &event);
    }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible API types (kept for backward compatibility)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub choices: Vec<ChatChoice>,
    #[serde(default)]
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ---------------------------------------------------------------------------
// AiBrain — low-level OpenAI-compatible HTTP client (unchanged)
// ---------------------------------------------------------------------------

pub struct AiBrain {
    client: Client,
    config: AiConfig,
}

impl AiBrain {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            config: AiConfig::default(),
        }
    }

    pub fn configure(&mut self, config: AiConfig) {
        self.config = config;
    }

    pub fn get_config(&self) -> &AiConfig {
        &self.config
    }

    /// Convert MCP tool definitions into the OpenAI function-calling format.
    pub fn mcp_tools_to_openai_functions(tools: &[McpTool]) -> Vec<Value> {
        tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description.clone().unwrap_or_default(),
                        "parameters": tool.input_schema
                    }
                })
            })
            .collect()
    }

    /// Send a chat completion request (non-streaming).
    pub async fn chat_completion(
        &self,
        messages: &[ChatMessage],
        tools: Option<&[Value]>,
    ) -> Result<ChatCompletionResponse, AppError> {
        if self.config.api_key.is_empty() {
            return Err(AppError::ai(
                "AI API key is not configured. Please set it in Settings.",
            ));
        }

        let url = format!(
            "{}/chat/completions",
            self.config.base_url.trim_end_matches('/')
        );

        let mut body = json!({
            "model": self.config.model_id,
            "messages": messages,
            "temperature": self.config.temperature,
        });

        if let Some(tool_defs) = tools {
            if !tool_defs.is_empty() {
                body["tools"] = json!(tool_defs);
                body["tool_choice"] = json!("auto");
            }
        }

        let mut request = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .bearer_token(&self.config.api_key);

        // Provider-specific headers.
        match self.config.provider {
            AiProvider::Claude => {
                request = self
                    .client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .header("x-api-key", &self.config.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("anthropic-beta", "tools-2024-04-04");
            }
            AiProvider::GithubCopilot => {
                request = request
                    .header("Copilot-Integration-Id", "vscode-chat")
                    .header("Editor-Version", "vscode/1.85.0")
                    .header("Editor-Plugin-Version", "copilot-chat/0.12.0");
            }
            AiProvider::Openrouter => {
                request = request
                    .header("HTTP-Referer", "https://newton-companion.app")
                    .header("X-Title", "Newton Companion");
            }
            _ => {}
        }

        let response = request
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ai(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response body".to_string());
            return Err(AppError::ai(format!(
                "AI API returned status {}: {}",
                status, body_text
            )));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| AppError::ai(format!("Failed to parse AI response: {}", e)))?;

        Ok(completion)
    }

    /// High-level chat with tool-use loop.
    /// Tool calls within a single response are executed in parallel for maximum throughput.
    pub async fn chat_with_tools<F, Fut>(
        &self,
        mut messages: Vec<ChatMessage>,
        tools: &[Value],
        execute_tool: F,
    ) -> Result<(String, Vec<ChatMessage>), AppError>
    where
        F: Fn(String, String) -> Fut,
        Fut: std::future::Future<Output = Result<String, AppError>>,
    {
        let max_iterations = 10;
        let tool_slice = if tools.is_empty() {
            None
        } else {
            Some(tools)
        };

        for _ in 0..max_iterations {
            let completion = self.chat_completion(&messages, tool_slice).await?;

            let choice = completion
                .choices
                .into_iter()
                .next()
                .ok_or_else(|| AppError::ai("No choices in AI response"))?;

            let assistant_msg = choice.message;
            messages.push(assistant_msg.clone());

            if let Some(ref tool_calls) = assistant_msg.tool_calls {
                if !tool_calls.is_empty() {
                    // Execute all tool calls in parallel for maximum throughput
                    let futures: Vec<_> = tool_calls
                        .iter()
                        .map(|tc| execute_tool(tc.function.name.clone(), tc.function.arguments.clone()))
                        .collect();

                    let results = join_all(futures).await;

                    for (tc, result) in tool_calls.iter().zip(results.into_iter()) {
                        let tool_result = match result {
                            Ok(text) => text,
                            Err(e) => format!("Error executing tool '{}': {}", tc.function.name, e),
                        };

                        messages.push(ChatMessage {
                            role: "tool".to_string(),
                            content: Some(tool_result),
                            tool_calls: None,
                            tool_call_id: Some(tc.id.clone()),
                        });
                    }
                    continue;
                }
            }

            let text = assistant_msg.content.unwrap_or_default();
            return Ok((text, messages));
        }

        Err(AppError::ai("Tool-use loop exceeded maximum iterations"))
    }
}

/// Extension trait so we can call `.bearer_token()` on reqwest::RequestBuilder.
trait BearerTokenExt {
    fn bearer_token(self, token: &str) -> Self;
}

impl BearerTokenExt for reqwest::RequestBuilder {
    fn bearer_token(self, token: &str) -> Self {
        self.header("Authorization", format!("Bearer {}", token))
    }
}

// ===========================================================================
// AgentBrain — the central orchestrator
// ===========================================================================

pub struct AgentBrain {
    // Core subsystems
    pub coordinator: Coordinator,
    pub memory: MemoryManager,
    pub tool_router: ToolRouter,

    // Runtime state
    active_goal: Option<AgentGoal>,
    current_plan: Option<AgentPlan>,
    is_running: bool,
    cancel_requested: bool,

    // Statistics
    total_goals_completed: u32,
    session_start: Instant,
}

impl AgentBrain {
    pub fn new() -> Self {
        Self {
            coordinator: Coordinator::new(),
            memory: MemoryManager::new(),
            tool_router: ToolRouter::new(),
            active_goal: None,
            current_plan: None,
            is_running: false,
            cancel_requested: false,
            total_goals_completed: 0,
            session_start: Instant::now(),
        }
    }

    /// Configure the primary LLM provider.
    pub fn configure(&mut self, config: AiConfig) {
        self.coordinator.update_primary(config);
    }

    /// Get the primary LLM config.
    pub fn get_config(&self) -> AiConfig {
        self.coordinator
            .get_primary_config()
            .cloned()
            .unwrap_or_default()
    }

    /// Request cancellation of the current goal.
    pub fn cancel_goal(&mut self) {
        self.cancel_requested = true;
    }

    /// Get a snapshot of the brain's current status.
    pub fn get_status(&self) -> BrainStatus {
        BrainStatus {
            active_goal: self.active_goal.clone(),
            current_plan: self.current_plan.clone(),
            is_running: self.is_running,
            total_goals_completed: self.total_goals_completed,
            memory_entries: self.memory.get_short_term_context().len() as u32,
            available_tools: self.tool_router.tool_names(),
            configured_providers: self.coordinator.configured_providers(),
        }
    }

    // -----------------------------------------------------------------------
    // Goal Execution — the main orchestration loop
    // -----------------------------------------------------------------------

    /// Execute a user goal end-to-end. This is the brain's primary entry point.
    pub async fn execute_goal(
        &mut self,
        goal_description: &str,
        context: Option<String>,
        db: &Arc<std::sync::Mutex<Connection>>,
        mcp_manager: &Arc<Mutex<McpManager>>,
        app_handle: Option<&AppHandle>,
    ) -> Result<String, AppError> {
        // Prevent concurrent goals
        if self.is_running {
            return Err(AppError::ai(
                "Brain is already executing a goal. Cancel it first or wait.",
            ));
        }

        self.is_running = true;
        self.cancel_requested = false;

        // Create the goal
        let goal = AgentGoal {
            id: Uuid::new_v4().to_string(),
            description: goal_description.to_string(),
            context: context.clone(),
            created_at: Utc::now(),
            status: GoalStatus::Planning,
        };
        let goal_id = goal.id.clone();
        self.active_goal = Some(goal.clone());

        // Persist goal to DB
        Self::persist_goal(db, &goal);

        emit_event(app_handle, BrainEvent::GoalAccepted {
            goal_id: goal_id.clone(),
            description: goal_description.to_string(),
        });

        // Run the orchestration loop with error handling
        let result = self
            .run_orchestration_loop(goal_description, &context, db, mcp_manager, app_handle)
            .await;

        // Finalize
        self.is_running = false;

        match result {
            Ok(output) => {
                // Update goal status
                if let Some(ref mut g) = self.active_goal {
                    g.status = GoalStatus::Completed;
                }
                self.total_goals_completed += 1;

                // Persist completion
                Self::complete_goal(db, &goal_id, &output);

                emit_event(app_handle, BrainEvent::GoalCompleted {
                    goal_id: goal_id.clone(),
                    summary: output.chars().take(200).collect(),
                });

                // Store success pattern in long-term memory
                let _ = self.memory.remember_long(
                    db,
                    format!(
                        "Successfully completed goal: {}",
                        goal_description.chars().take(100).collect::<String>()
                    ),
                    MemoryCategory::LearnedPattern,
                    vec!["goal_success".to_string()],
                    0.7,
                );

                // Clear short-term memory for next task
                self.memory.clear_short_term();
                self.active_goal = None;
                self.current_plan = None;

                Ok(output)
            }
            Err(e) => {
                if let Some(ref mut g) = self.active_goal {
                    g.status = GoalStatus::Failed;
                }

                Self::fail_goal(db, &goal_id, &e.to_string());

                emit_event(app_handle, BrainEvent::GoalFailed {
                    goal_id: goal_id.clone(),
                    error: e.to_string(),
                });

                // Store failure pattern
                let _ = self.memory.remember_long(
                    db,
                    format!(
                        "Failed goal '{}': {}",
                        goal_description.chars().take(60).collect::<String>(),
                        e
                    ),
                    MemoryCategory::ErrorSolution,
                    vec!["goal_failure".to_string()],
                    0.8,
                );

                self.memory.clear_short_term();
                self.active_goal = None;
                self.current_plan = None;

                Err(e)
            }
        }
    }

    /// The inner orchestration loop: plan → execute → observe → heal → learn.
    async fn run_orchestration_loop(
        &mut self,
        goal: &str,
        context: &Option<String>,
        db: &Arc<std::sync::Mutex<Connection>>,
        mcp_manager: &Arc<Mutex<McpManager>>,
        app_handle: Option<&AppHandle>,
    ) -> Result<String, AppError> {
        let goal_id = self
            .active_goal
            .as_ref()
            .map(|g| g.id.clone())
            .unwrap_or_default();

        let max_revisions = 3;

        for revision in 0..max_revisions {
            // Check cancellation
            if self.cancel_requested {
                return Err(AppError::ai("Goal was cancelled by user"));
            }

            // 1. Build memory context
            let tags = vec![
                "goal".to_string(),
                goal.split_whitespace()
                    .take(3)
                    .collect::<Vec<_>>()
                    .join("_"),
            ];
            let memory_context = self.memory.build_context(db, &tags);

            // 2. Discover available tools
            let available_tools = self
                .tool_router
                .get_tools(mcp_manager)
                .await
                .unwrap_or_default();

            // 3. Generate plan via LLM
            emit_event(app_handle, BrainEvent::PlanningStarted {
                goal_id: goal_id.clone(),
            });

            let failed_step = if revision > 0 {
                // On re-plan, provide the failed step for context
                self.current_plan
                    .as_ref()
                    .and_then(|p| p.steps.iter().find(|s| s.status == StepStatus::Failed))
                    .cloned()
            } else {
                None
            };

            let planning_prompt = Planner::build_planning_prompt(
                goal,
                &available_tools,
                &memory_context,
                failed_step.as_ref(),
            );

            // Add user context if provided
            let full_goal = if let Some(ctx) = context {
                format!("{}\n\nAdditional context: {}", goal, ctx)
            } else {
                goal.to_string()
            };

            let plan_request = LlmRequest {
                messages: vec![
                    LlmMessage {
                        role: "system".to_string(),
                        content: planning_prompt,
                    },
                    LlmMessage {
                        role: "user".to_string(),
                        content: full_goal.clone(),
                    },
                ],
                tools: None,
                temperature: Some(0.3), // Lower temp for planning
                max_tokens: None,
                task_type: TaskType::Reasoning,
                force_provider: None,
            };

            let plan_response = self.coordinator.route_request(&plan_request).await?;

            // 4. Parse plan
            let mut plan =
                Planner::parse_plan(&goal_id, &plan_response.content, revision as u32)?;

            emit_event(app_handle, BrainEvent::PlanGenerated {
                goal_id: goal_id.clone(),
                step_count: plan.steps.len(),
                reasoning: plan.reasoning.clone(),
            });

            self.current_plan = Some(plan.clone());

            // Store plan in short-term memory
            self.memory.remember_short(
                format!(
                    "Plan (rev {}): {} steps — {}",
                    revision,
                    plan.steps.len(),
                    plan.reasoning
                ),
                vec!["plan".to_string()],
            );

            // 5. Execute plan
            let exec_result = Executor::execute_plan(
                &mut plan,
                &mut self.coordinator,
                &self.tool_router,
                &mut self.memory,
                mcp_manager,
                db,
                app_handle,
            )
            .await;

            self.current_plan = Some(plan.clone());

            match exec_result {
                Ok(output) => {
                    // Update goal in DB with plan
                    if let Ok(plan_json) = serde_json::to_string(&plan) {
                        if let Ok(conn) = db.lock() {
                            let completed = plan
                                .steps
                                .iter()
                                .filter(|s| s.status == StepStatus::Completed)
                                .count();
                            let _ = conn.execute(
                                "UPDATE brain_goals SET plan_json = ?1, total_steps = ?2, completed_steps = ?3, revision = ?4 WHERE id = ?5",
                                rusqlite::params![plan_json, plan.steps.len(), completed, revision, goal_id],
                            );
                        }
                    }

                    return Ok(output);
                }
                Err(e) => {
                    tracing::warn!(
                        "Plan revision {} failed: {}. Attempting replan ({}/{})",
                        revision,
                        e,
                        revision + 1,
                        max_revisions
                    );

                    if revision < max_revisions - 1 {
                        emit_event(app_handle, BrainEvent::Replanning {
                            goal_id: goal_id.clone(),
                            reason: e.to_string(),
                        });
                        // Loop continues with next revision
                    } else {
                        return Err(AppError::ai(format!(
                            "Goal failed after {} plan revisions. Last error: {}",
                            max_revisions, e
                        )));
                    }
                }
            }
        }

        Err(AppError::ai("Orchestration loop exited unexpectedly"))
    }

    // -----------------------------------------------------------------------
    // Simple Chat — delegates to coordinator (no planning)
    // -----------------------------------------------------------------------

    /// Simple chat interface — sends a message through the configured LLM
    /// with MCP tool support + built-in tools (Google Calendar, integrations).
    /// Collects tools from all connected servers in parallel and executes
    /// multiple tool calls concurrently within each response turn.
    /// Injects MCP server instructions and cached Newton data for rich context.
    pub async fn chat(
        &mut self,
        message: &str,
        history: Vec<ChatMessage>,
        mcp_manager: &Arc<Mutex<McpManager>>,
        google_calendar: &Arc<Mutex<GoogleCalendarClient>>,
        db: &Arc<std::sync::Mutex<Connection>>,
    ) -> Result<(String, Vec<ChatMessage>, std::collections::HashMap<String, String>), AppError> {
        let config = self.get_config();

        // Check Google Calendar connection status
        let calendar_connected = {
            let gcal = google_calendar.lock().await;
            gcal.is_connected()
        };

        // Check if Notion MCP is connected
        let notion_connected = {
            let mgr = mcp_manager.lock().await;
            mgr.is_connected("integration-notion")
        };

        // Collect MCP tools, build tool→server map, and gather server instructions
        let (mut tools_openai, mut tool_server_map, mut tool_descriptions, server_instructions) = {
            let manager = mcp_manager.lock().await;
            let server_ids = manager.connected_server_ids();
            let mut all_tools: Vec<Value> = Vec::new();
            let mut tool_map: std::collections::HashMap<String, String> =
                std::collections::HashMap::new();
            // server_id → list of (tool_name, description)
            let mut server_tool_list: Vec<(String, Vec<(String, String)>)> = Vec::new();
            // Collect server instructions from MCP initialize handshake
            let instructions = manager.all_server_instructions();

            for sid in &server_ids {
                match manager.list_tools(sid).await {
                    Ok(tools_result) => {
                        let openai_fns =
                            AiBrain::mcp_tools_to_openai_functions(&tools_result.tools);
                        let mut tool_pairs = Vec::new();
                        for tool in &tools_result.tools {
                            tool_map.insert(tool.name.clone(), sid.clone());
                            tool_pairs.push((
                                tool.name.clone(),
                                tool.description.clone().unwrap_or_default(),
                            ));
                        }
                        if !tool_pairs.is_empty() {
                            server_tool_list.push((sid.clone(), tool_pairs));
                        }
                        all_tools.extend(openai_fns);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to list tools for server '{}': {}", sid, e);
                    }
                }
            }

            (all_tools, tool_map, server_tool_list, instructions)
        };

        // Add built-in tools (calendar, integrations check)
        let builtin_tools = builtin_tools::builtin_tool_definitions(calendar_connected);
        if !builtin_tools.is_empty() {
            let builtin_openai = AiBrain::mcp_tools_to_openai_functions(&builtin_tools);
            let mut builtin_pairs = Vec::new();
            for tool in &builtin_tools {
                tool_server_map.insert(tool.name.clone(), "__builtin__".to_string());
                builtin_pairs.push((
                    tool.name.clone(),
                    tool.description.clone().unwrap_or_default(),
                ));
            }
            tool_descriptions.push(("Built-in (Newton Companion)".to_string(), builtin_pairs));
            tools_openai.extend(builtin_openai);
        }

        let mut brain = AiBrain::new();
        brain.configure(config);

        // Build the conversation: inject a system prompt if not already present
        let mut messages = history;
        let has_system = messages.first().map(|m| m.role == "system").unwrap_or(false);

        if !has_system {
            // Load cached Newton data summary for context injection
            let cached_summary = Self::build_cached_data_summary(db);

            let system_content = Self::build_mcp_system_prompt(
                &tool_descriptions,
                calendar_connected,
                notion_connected,
                &server_instructions,
                &cached_summary,
            );
            messages.insert(0, ChatMessage {
                role: "system".to_string(),
                content: Some(system_content),
                tool_calls: None,
                tool_call_id: None,
            });
        }

        messages.push(ChatMessage {
            role: "user".to_string(),
            content: Some(message.to_string()),
            tool_calls: None,
            tool_call_id: None,
        });

        let mcp_clone = mcp_manager.clone();
        let gcal_clone = google_calendar.clone();
        let tsm_clone = tool_server_map.clone();

        let (response_text, final_messages) = brain
            .chat_with_tools(messages, &tools_openai, |tool_name, arguments_str| {
                let mgr = mcp_clone.clone();
                let gcal = gcal_clone.clone();
                let tsm = tsm_clone.clone();
                async move {
                    let args: Value = serde_json::from_str(&arguments_str)
                        .unwrap_or(Value::Object(Default::default()));

                    // Route to built-in tools or MCP
                    if builtin_tools::is_builtin_tool(&tool_name) {
                        let notion_connected = {
                            let m = mgr.lock().await;
                            m.is_connected("integration-notion")
                        };
                        return builtin_tools::execute_builtin_tool(
                            &tool_name,
                            args,
                            &gcal,
                            notion_connected,
                        )
                        .await;
                    }

                    // MCP tool execution
                    let server_id = tsm.get(&tool_name).cloned().ok_or_else(|| {
                        AppError::mcp(format!(
                            "No MCP server found for tool '{}'. Available tools: {:?}",
                            tool_name,
                            tsm.keys().collect::<Vec<_>>()
                        ))
                    })?;

                    let manager = mgr.lock().await;
                    let result = manager.call_tool(&server_id, &tool_name, args).await?;

                    // Aggregate all content blocks into a single string
                    let text: String = result
                        .content
                        .iter()
                        .filter_map(|c| c.text.as_ref())
                        .cloned()
                        .collect::<Vec<_>>()
                        .join("\n");

                    Ok(text)
                }
            })
            .await?;

        Ok((response_text, final_messages, tool_server_map))
    }

    /// Build a system prompt that describes all available tools and integrations.
    /// Injects MCP server instructions (especially Newton School's detailed
    /// platform context) and a summary of cached student data so the LLM
    /// has immediate context without re-fetching.
    fn build_mcp_system_prompt(
        server_tool_list: &[(String, Vec<(String, String)>)],
        calendar_connected: bool,
        notion_connected: bool,
        server_instructions: &[(String, String)],
        cached_data_summary: &str,
    ) -> String {
        let mut lines = Vec::new();

        // Core identity
        lines.push("You are Newton Companion, an intelligent AI brain for Newton School students.".to_string());
        lines.push("You are NOT just a chatbot — you are an autonomous agent that can take real actions.".to_string());
        lines.push(String::new());

        // Integration awareness
        lines.push("## Connected Integrations".to_string());
        if calendar_connected {
            lines.push("- **Google Calendar**: CONNECTED — You can create, list, and delete calendar events.".to_string());
        } else {
            lines.push("- **Google Calendar**: Not connected — Suggest the user connect it in Integrations.".to_string());
        }
        if notion_connected {
            lines.push("- **Notion**: CONNECTED — You can search, read, create, and update Notion pages and databases.".to_string());
        } else {
            lines.push("- **Notion**: Not connected — Suggest the user add their Notion API key in Integrations.".to_string());
        }
        lines.push(String::new());

        // Available tools
        if !server_tool_list.is_empty() {
            lines.push("## Available Tools".to_string());
            lines.push(String::new());

            for (server_id, tools) in server_tool_list {
                lines.push(format!("### {}", server_id));
                for (name, desc) in tools {
                    let desc_short = if desc.is_empty() {
                        "No description".to_string()
                    } else {
                        desc.chars().take(150).collect()
                    };
                    lines.push(format!("- **{}**: {}", name, desc_short));
                }
                lines.push(String::new());
            }
        }

        // Capabilities
        lines.push("## What You Can Do".to_string());
        lines.push(String::new());

        if calendar_connected {
            lines.push("### Scheduling & Calendar".to_string());
            lines.push("- Create study sessions, exam prep blocks, and assignment deadlines on Google Calendar".to_string());
            lines.push("- Check the user's schedule to find free time before suggesting events".to_string());
            lines.push("- Set appropriate reminders (e.g., 30min before lectures, 1 day before assignments)".to_string());
            lines.push("- Use color coding: lecture=blue, contest=red, assignment=orange, assessment=purple".to_string());
            lines.push(String::new());
        }

        if notion_connected {
            lines.push("### Notes & Knowledge (Notion)".to_string());
            lines.push("- Search existing Notion pages for relevant notes or information".to_string());
            lines.push("- Create new pages for lecture notes, study summaries, or project plans".to_string());
            lines.push("- Update existing pages with new information".to_string());
            lines.push("- Organize content by linking related pages together".to_string());
            lines.push(String::new());
        }

        if calendar_connected && notion_connected {
            lines.push("### Cross-Linking & Orchestration".to_string());
            lines.push("- When creating a study plan, BOTH schedule it on calendar AND create a Notion page with the plan details".to_string());
            lines.push("- When the user asks about upcoming events, check calendar AND search Notion for related notes".to_string());
            lines.push("- Link Notion pages to calendar events by including event IDs in page content".to_string());
            lines.push(String::new());
        }

        // Instructions
        lines.push("## Instructions".to_string());
        lines.push("- **Always** call relevant tools to fetch real, up-to-date data before answering.".to_string());
        lines.push("- When multiple independent data points are needed, call several tools simultaneously (in parallel).".to_string());
        lines.push("- Be proactive: if the user mentions a deadline, offer to schedule study time for it.".to_string());
        lines.push("- When scheduling, always check existing events first to avoid conflicts.".to_string());
        lines.push("- Aggregate and synthesise results from multiple tool calls into a clear, useful answer.".to_string());
        lines.push("- If a tool call returns an error, explain it and try an alternative approach.".to_string());
        lines.push("- Format responses in clear markdown with headers and bullet points.".to_string());
        lines.push("- Use the current date (today) as reference for scheduling. Don't ask for dates that are obvious.".to_string());
        lines.push("- When the user asks to 'schedule', 'plan', or 'organize' something, take action immediately by calling the appropriate tools.".to_string());
        lines.push(String::new());

        // Server instructions (injected from MCP server initialize handshake)
        // These contain critical context, especially Newton School's platform docs.
        if !server_instructions.is_empty() {
            lines.push("## MCP Server Instructions".to_string());
            lines.push(String::new());
            for (server_id, instructions) in server_instructions {
                lines.push(format!("### Instructions from `{}`", server_id));
                lines.push(instructions.clone());
                lines.push(String::new());
            }
        }

        // Cached student data summary (so the LLM has immediate context)
        if !cached_data_summary.is_empty() {
            lines.push("## Current Student Data (cached snapshot)".to_string());
            lines.push("Use this as context. For the most up-to-date data, call the relevant tools.".to_string());
            lines.push(String::new());
            lines.push(cached_data_summary.to_string());
            lines.push(String::new());
        }

        lines.join("\n")
    }

    // -----------------------------------------------------------------------
    // Cached Data Summary — inject Newton data context into the AI prompt
    // -----------------------------------------------------------------------

    /// Build a concise summary of cached Newton data for the system prompt.
    /// This gives the LLM immediate context about the student's courses,
    /// schedule, assignments, and progress without needing tool calls.
    fn build_cached_data_summary(db: &Arc<std::sync::Mutex<Connection>>) -> String {
        let conn = match db.lock() {
            Ok(c) => c,
            Err(_) => return String::new(),
        };

        let mut summary_parts = Vec::new();

        // Helper: read cached tool result from DB
        let read_cached = |tool_name: &str| -> Option<Value> {
            conn.query_row(
                "SELECT response_json FROM newton_data_cache WHERE tool_name = ?1",
                rusqlite::params![tool_name],
                |row| {
                    let json_str: String = row.get(0)?;
                    Ok(serde_json::from_str::<Value>(&json_str).unwrap_or(Value::Null))
                },
            )
            .ok()
            .filter(|v| !v.is_null())
        };

        // User profile
        if let Some(profile) = read_cached("get_me") {
            let name = profile["name"].as_str().unwrap_or("");
            let email = profile["email"].as_str().unwrap_or("");
            if !name.is_empty() {
                summary_parts.push(format!("**Student**: {} ({})", name, email));
            }
        }

        // Courses overview
        if let Some(overview) = read_cached("get_course_overview") {
            let course_name = overview["course_name"].as_str().unwrap_or("");
            let semester = overview["semester_name"].as_str().unwrap_or("");
            let xp = overview["total_xp"].as_u64().or_else(|| overview["total_earned_points"].as_u64());
            let rank = overview["rank"].as_u64();
            let lectures_attended = overview["lectures_attended"].as_u64()
                .or_else(|| overview["total_lectures_attended"].as_u64());
            let total_lectures = overview["total_lectures"].as_u64();
            let assignments_done = overview["assignments_completed"].as_u64()
                .or_else(|| overview["total_completed_assignment_questions"].as_u64());

            let mut parts = Vec::new();
            if !course_name.is_empty() { parts.push(format!("Course: {}", course_name)); }
            if !semester.is_empty() { parts.push(format!("Semester: {}", semester)); }
            if let Some(x) = xp { parts.push(format!("XP: {}", x)); }
            if let Some(r) = rank { parts.push(format!("Rank: #{}", r)); }
            if let (Some(a), Some(t)) = (lectures_attended, total_lectures) {
                parts.push(format!("Lectures: {}/{} attended", a, t));
            }
            if let Some(a) = assignments_done {
                parts.push(format!("Assignments completed: {}", a));
            }
            if !parts.is_empty() {
                summary_parts.push(parts.join(" | "));
            }
        }

        // Upcoming schedule (next 3 items)
        if let Some(schedule) = read_cached("get_upcoming_schedule") {
            let events = schedule.as_array()
                .or_else(|| schedule["events"].as_array())
                .or_else(|| schedule["schedule"].as_array())
                .or_else(|| schedule["data"].as_array());
            if let Some(events) = events {
                let upcoming: Vec<String> = events.iter().take(3).filter_map(|e| {
                    let title = e["title"].as_str()
                        .or_else(|| e["lecture_title"].as_str())
                        .or_else(|| e["name"].as_str())?;
                    let time = e["start_time"].as_str()
                        .or_else(|| e["start"].as_str())
                        .unwrap_or("TBD");
                    Some(format!("  - {} ({})", title, time))
                }).collect();
                if !upcoming.is_empty() {
                    summary_parts.push(format!("**Upcoming**:\n{}", upcoming.join("\n")));
                }
            }
        }

        // Arena stats
        if let Some(arena) = read_cached("get_arena_stats") {
            let solved = arena["solved_questions_count"].as_u64();
            if let Some(s) = solved {
                summary_parts.push(format!("**Arena**: {} problems solved", s));
            }
        }

        summary_parts.join("\n")
    }

    // -----------------------------------------------------------------------
    // Goal History — DB queries
    // -----------------------------------------------------------------------

    /// Get past goals from the database.
    pub fn get_goal_history(
        db: &Arc<std::sync::Mutex<Connection>>,
        limit: usize,
    ) -> Result<Vec<Value>, AppError> {
        let conn = db
            .lock()
            .map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, description, status, result_summary, created_at, completed_at, total_steps, completed_steps, revision
             FROM brain_goals ORDER BY created_at DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map(rusqlite::params![limit as i64], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "description": row.get::<_, String>(1)?,
                "status": row.get::<_, String>(2)?,
                "result_summary": row.get::<_, Option<String>>(3)?,
                "created_at": row.get::<_, String>(4)?,
                "completed_at": row.get::<_, Option<String>>(5)?,
                "total_steps": row.get::<_, i64>(6)?,
                "completed_steps": row.get::<_, i64>(7)?,
                "revision": row.get::<_, i64>(8)?,
            }))
        })?;

        let mut goals = Vec::new();
        for row in rows {
            if let Ok(goal) = row {
                goals.push(goal);
            }
        }

        Ok(goals)
    }

    // -----------------------------------------------------------------------
    // DB Helpers
    // -----------------------------------------------------------------------

    fn persist_goal(db: &Arc<std::sync::Mutex<Connection>>, goal: &AgentGoal) {
        if let Ok(conn) = db.lock() {
            let now = goal.created_at.to_rfc3339();
            let _ = conn.execute(
                "INSERT INTO brain_goals (id, description, context, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![goal.id, goal.description, goal.context, "planning", now],
            );
        }
    }

    fn complete_goal(db: &Arc<std::sync::Mutex<Connection>>, goal_id: &str, summary: &str) {
        if let Ok(conn) = db.lock() {
            let now = Utc::now().to_rfc3339();
            let preview: String = summary.chars().take(500).collect();
            let _ = conn.execute(
                "UPDATE brain_goals SET status = 'completed', result_summary = ?1, completed_at = ?2 WHERE id = ?3",
                rusqlite::params![preview, now, goal_id],
            );
        }
    }

    fn fail_goal(db: &Arc<std::sync::Mutex<Connection>>, goal_id: &str, error: &str) {
        if let Ok(conn) = db.lock() {
            let now = Utc::now().to_rfc3339();
            let _ = conn.execute(
                "UPDATE brain_goals SET status = 'failed', result_summary = ?1, completed_at = ?2 WHERE id = ?3",
                rusqlite::params![error, now, goal_id],
            );
        }
    }
}
