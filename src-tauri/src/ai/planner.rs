use serde_json::Value;

use crate::ai::types::*;
use crate::error::AppError;

// ---------------------------------------------------------------------------
// Planner — decomposes goals into executable step sequences
// ---------------------------------------------------------------------------

pub struct Planner;

impl Planner {
    /// Build the system prompt that instructs the LLM to create a plan.
    pub fn build_planning_prompt(
        goal: &str,
        available_tools: &[AvailableTool],
        memory_context: &str,
        failed_step: Option<&PlanStep>,
    ) -> String {
        let mut prompt = String::from(
            "You are an AI agent planner. Your job is to decompose a user's goal into a sequence of concrete, executable steps.\n\n\
             RULES:\n\
             1. Each step must be ONE atomic action — a single tool call, a single LLM query, or a synthesis.\n\
             2. Steps run in order. A step can depend on previous steps' outputs.\n\
             3. Use available tools when they can accomplish the step.\n\
             4. For analysis, reasoning, or text generation, use an LLM query step.\n\
             5. Use a synthesis step to combine results from multiple steps into a final answer.\n\
             6. Keep plans minimal — fewest steps that accomplish the goal.\n\
             7. Each step needs: id (1-based integer), type, description, depends_on (list of step ids).\n\n"
        );

        // Available tools
        if !available_tools.is_empty() {
            prompt.push_str("AVAILABLE TOOLS:\n");
            for tool in available_tools {
                prompt.push_str(&format!(
                    "- {} (server: {}): {}\n",
                    tool.name, tool.server_name, tool.description
                ));
            }
            prompt.push('\n');
        }

        // Memory context
        if !memory_context.is_empty() {
            prompt.push_str("CONTEXT FROM MEMORY:\n");
            prompt.push_str(memory_context);
            prompt.push_str("\n\n");
        }

        // If re-planning after failure
        if let Some(step) = failed_step {
            prompt.push_str("IMPORTANT: A previous plan failed at this step:\n");
            prompt.push_str(&format!("  Step {}: {}\n", step.id, step.description));
            if let Some(ref result) = step.result {
                if let Some(ref err) = result.error {
                    prompt.push_str(&format!("  Error: {}\n", err));
                }
            }
            prompt.push_str("Generate an ALTERNATIVE plan that avoids this failure.\n\n");
        }

        prompt.push_str(&format!("GOAL: {}\n\n", goal));
        prompt.push_str(
            "Respond with ONLY a JSON object in this exact format:\n\
             ```json\n\
             {\n\
               \"reasoning\": \"Brief explanation of your approach\",\n\
               \"steps\": [\n\
                 {\n\
                   \"id\": 1,\n\
                   \"type\": \"tool_call\",\n\
                   \"description\": \"What this step does\",\n\
                   \"depends_on\": [],\n\
                   \"tool_name\": \"tool_name_here\",\n\
                   \"arguments\": {}\n\
                 },\n\
                 {\n\
                   \"id\": 2,\n\
                   \"type\": \"llm_query\",\n\
                   \"description\": \"What this step does\",\n\
                   \"depends_on\": [1],\n\
                   \"prompt\": \"The prompt for the LLM\"\n\
                 },\n\
                 {\n\
                   \"id\": 3,\n\
                   \"type\": \"synthesize\",\n\
                   \"description\": \"Combine results\",\n\
                   \"depends_on\": [1, 2],\n\
                   \"instruction\": \"How to combine\"\n\
                 }\n\
               ]\n\
             }\n\
             ```\n\
             \n\
             Valid step types: tool_call, llm_query, synthesize\n\
             For tool_call: include tool_name and arguments.\n\
             For llm_query: include prompt.\n\
             For synthesize: include step_ids (list of step ids to combine) and instruction."
        );

        prompt
    }

    /// Parse the LLM's planning response into an AgentPlan.
    pub fn parse_plan(
        goal_id: &str,
        response: &str,
        revision: u32,
    ) -> Result<AgentPlan, AppError> {
        // Extract JSON from the response (might be wrapped in markdown code blocks)
        let json_str = extract_json(response)?;
        let parsed: Value = serde_json::from_str(&json_str)
            .map_err(|e| AppError::ai(format!("Failed to parse plan JSON: {}. Raw: {}", e, &json_str[..json_str.len().min(500)])))?;

        let reasoning = parsed["reasoning"]
            .as_str()
            .unwrap_or("No reasoning provided")
            .to_string();

        let steps_val = parsed["steps"]
            .as_array()
            .ok_or_else(|| AppError::ai("Plan JSON missing 'steps' array"))?;

        let mut steps = Vec::new();

        for step_val in steps_val {
            let id = step_val["id"].as_u64().unwrap_or(0) as u32;
            let step_type = step_val["type"].as_str().unwrap_or("llm_query");
            let description = step_val["description"]
                .as_str()
                .unwrap_or("Unnamed step")
                .to_string();
            let depends_on: Vec<u32> = step_val["depends_on"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect())
                .unwrap_or_default();

            let action = match step_type {
                "tool_call" => StepAction::ToolCall {
                    tool_name: step_val["tool_name"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    arguments: step_val["arguments"].clone(),
                },
                "llm_query" => StepAction::LlmQuery {
                    prompt: step_val["prompt"]
                        .as_str()
                        .unwrap_or(&description)
                        .to_string(),
                    system_prompt: step_val["system_prompt"]
                        .as_str()
                        .map(|s| s.to_string()),
                    preferred_provider: step_val["preferred_provider"]
                        .as_str()
                        .map(|s| s.to_string()),
                },
                "synthesize" => StepAction::Synthesize {
                    step_ids: step_val["step_ids"]
                        .as_array()
                        .map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect())
                        .unwrap_or_else(|| depends_on.clone()),
                    instruction: step_val["instruction"]
                        .as_str()
                        .unwrap_or(&description)
                        .to_string(),
                },
                _ => StepAction::LlmQuery {
                    prompt: description.clone(),
                    system_prompt: None,
                    preferred_provider: None,
                },
            };

            steps.push(PlanStep {
                id,
                action,
                description,
                depends_on,
                status: StepStatus::Pending,
                result: None,
                retries: 0,
                max_retries: 3,
            });
        }

        if steps.is_empty() {
            return Err(AppError::ai("Plan has no steps"));
        }

        Ok(AgentPlan {
            goal_id: goal_id.to_string(),
            steps,
            reasoning,
            revision,
            created_at: chrono::Utc::now(),
        })
    }

    /// Get the next step(s) that are ready to execute (all dependencies satisfied).
    pub fn next_ready_steps(plan: &AgentPlan) -> Vec<u32> {
        let completed: Vec<u32> = plan
            .steps
            .iter()
            .filter(|s| s.status == StepStatus::Completed || s.status == StepStatus::Skipped)
            .map(|s| s.id)
            .collect();

        plan.steps
            .iter()
            .filter(|s| {
                s.status == StepStatus::Pending
                    && s.depends_on.iter().all(|dep| completed.contains(dep))
            })
            .map(|s| s.id)
            .collect()
    }

    /// Check if the plan is fully complete.
    pub fn is_complete(plan: &AgentPlan) -> bool {
        plan.steps.iter().all(|s| {
            s.status == StepStatus::Completed || s.status == StepStatus::Skipped
        })
    }

    /// Check if the plan has any failed steps that haven't been retried.
    pub fn has_unrecoverable_failure(plan: &AgentPlan) -> bool {
        plan.steps.iter().any(|s| {
            s.status == StepStatus::Failed && s.retries >= s.max_retries
        })
    }

    /// Collect outputs from completed steps (for synthesis or context).
    pub fn collect_outputs(plan: &AgentPlan, step_ids: &[u32]) -> Vec<(u32, String)> {
        plan.steps
            .iter()
            .filter(|s| step_ids.contains(&s.id))
            .filter_map(|s| {
                s.result.as_ref().map(|r| (s.id, r.output.clone()))
            })
            .collect()
    }
}

/// Extract JSON from a response that might contain markdown code blocks.
fn extract_json(text: &str) -> Result<String, AppError> {
    // Try to find JSON in code blocks first
    if let Some(start) = text.find("```json") {
        let json_start = start + 7;
        if let Some(end) = text[json_start..].find("```") {
            return Ok(text[json_start..json_start + end].trim().to_string());
        }
    }

    // Try plain code blocks
    if let Some(start) = text.find("```") {
        let json_start = start + 3;
        // Skip optional language identifier on the same line
        let actual_start = text[json_start..]
            .find('\n')
            .map(|n| json_start + n + 1)
            .unwrap_or(json_start);
        if let Some(end) = text[actual_start..].find("```") {
            return Ok(text[actual_start..actual_start + end].trim().to_string());
        }
    }

    // Try to find raw JSON object
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            if end > start {
                return Ok(text[start..=end].to_string());
            }
        }
    }

    Err(AppError::ai("Could not extract JSON from LLM response"))
}
