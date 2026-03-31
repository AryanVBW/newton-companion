use serde_json::{json, Value};
use tauri::State;

use crate::ai::brain::{AgentBrain, ChatMessage};
use crate::ai::providers::{AiConfig, AiProvider};
use crate::ai::types::MemoryCategory;
use crate::state::AppState;

// ===========================================================================
// Chat — simple conversational interface (no autonomous planning)
// ===========================================================================

/// Send a chat message and get a response.
/// Supports parallel MCP tool execution with all connected servers.
/// Returns the tool→server map so the frontend can display accurate server names.
#[tauri::command]
pub async fn ai_chat(
    state: State<'_, AppState>,
    message: String,
    history: Option<Vec<ChatMessage>>,
) -> Result<Value, String> {
    let messages = history.unwrap_or_default();
    let mcp_manager = state.mcp_manager.clone();

    let mut brain = state.agent_brain.lock().await;
    let (response_text, final_messages, tool_server_map) = brain
        .chat(&message, messages, &mcp_manager)
        .await
        .map_err(|e| e.to_string())?;

    // Build tool_server_map as a JSON object for the frontend
    let tsm_json: serde_json::Map<String, Value> = tool_server_map
        .into_iter()
        .map(|(k, v)| (k, Value::String(v)))
        .collect();

    Ok(json!({
        "response": response_text,
        "messages": final_messages,
        "tool_server_map": tsm_json,
    }))
}

// ===========================================================================
// AI Configuration
// ===========================================================================

/// Configure the AI provider settings.
#[tauri::command]
pub async fn ai_configure(
    state: State<'_, AppState>,
    provider: String,
    base_url: String,
    api_key: String,
    model_id: String,
) -> Result<(), String> {
    let provider_enum = AiProvider::from_str_loose(&provider);
    let resolved_base_url = if base_url.is_empty() {
        provider_enum.default_base_url().to_string()
    } else {
        base_url
    };

    let config = AiConfig {
        provider: provider_enum,
        base_url: resolved_base_url.clone(),
        api_key: api_key.clone(),
        model_id: model_id.clone(),
        temperature: 0.7,
    };

    // Update the in-memory brain.
    {
        let mut brain = state.agent_brain.lock().await;
        brain.configure(config);
    }

    // Persist to the database.
    {
        let db = state.db.lock().unwrap();
        db.execute(
            "UPDATE ai_config SET provider = ?1, base_url = ?2, api_key = ?3, model_id = ?4 WHERE id = 1",
            rusqlite::params![provider, resolved_base_url, api_key, model_id],
        )
        .map_err(|e| format!("Failed to save AI config: {}", e))?;
    }

    Ok(())
}

/// Get the current AI configuration.
#[tauri::command]
pub async fn ai_get_config(state: State<'_, AppState>) -> Result<Value, String> {
    let brain = state.agent_brain.lock().await;
    let config = brain.get_config();

    Ok(json!({
        "provider": config.provider,
        "base_url": config.base_url,
        "api_key": if config.api_key.is_empty() { "" } else { "***" },
        "model_id": config.model_id,
        "temperature": config.temperature,
        "has_key": !config.api_key.is_empty(),
    }))
}

/// List available models for a given provider.
#[tauri::command]
pub async fn ai_list_models(
    _state: State<'_, AppState>,
    provider: String,
) -> Result<Value, String> {
    let provider_enum = AiProvider::from_str_loose(&provider);
    let models = provider_enum.default_models();
    serde_json::to_value(&models).map_err(|e| e.to_string())
}

// ===========================================================================
// Brain Commands — Autonomous Goal Execution
// ===========================================================================

/// Submit a goal for autonomous execution by the Agent Brain.
/// The brain will plan, execute, observe, and self-heal automatically.
#[tauri::command]
pub async fn brain_execute_goal(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    goal: String,
    context: Option<String>,
) -> Result<Value, String> {
    let db = state.db.clone();
    let mcp_manager = state.mcp_manager.clone();

    let mut brain = state.agent_brain.lock().await;
    let result = brain
        .execute_goal(&goal, context, &db, &mcp_manager, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "success": true,
        "result": result,
    }))
}

/// Get the current status of the Agent Brain.
#[tauri::command]
pub async fn brain_get_status(state: State<'_, AppState>) -> Result<Value, String> {
    let brain = state.agent_brain.lock().await;
    let status = brain.get_status();
    serde_json::to_value(&status).map_err(|e| e.to_string())
}

/// Cancel the currently running goal.
#[tauri::command]
pub async fn brain_cancel_goal(state: State<'_, AppState>) -> Result<Value, String> {
    let mut brain = state.agent_brain.lock().await;
    brain.cancel_goal();
    Ok(json!({ "success": true, "message": "Cancellation requested" }))
}

/// Get past goals and their results from the brain's history.
#[tauri::command]
pub async fn brain_get_history(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Value, String> {
    let db = state.db.clone();
    let goals = AgentBrain::get_goal_history(&db, limit.unwrap_or(20))
        .map_err(|e| e.to_string())?;
    Ok(json!({ "goals": goals }))
}

/// Query the brain's memory (short-term and long-term).
#[tauri::command]
pub async fn brain_get_memory(
    state: State<'_, AppState>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    limit: Option<usize>,
) -> Result<Value, String> {
    let db = state.db.clone();
    let brain = state.agent_brain.lock().await;

    let cat = category.map(|c| match c.as_str() {
        "short_term" => MemoryCategory::ShortTerm,
        "learned_pattern" => MemoryCategory::LearnedPattern,
        "project_knowledge" => MemoryCategory::ProjectKnowledge,
        "tool_pattern" => MemoryCategory::ToolPattern,
        "error_solution" => MemoryCategory::ErrorSolution,
        "user_preference" => MemoryCategory::UserPreference,
        _ => MemoryCategory::ShortTerm,
    });

    let tag_list = tags.unwrap_or_default();
    let max = limit.unwrap_or(50);

    // Get long-term memories
    let long_term = brain
        .memory
        .recall_long(&db, cat, &tag_list, max)
        .map_err(|e| e.to_string())?;

    // Get short-term memories
    let short_term = brain.memory.get_short_term_context();

    Ok(json!({
        "short_term": short_term.iter().map(|e| json!({
            "id": e.id,
            "category": e.category,
            "content": e.content,
            "tags": e.context_tags,
            "importance": e.importance,
        })).collect::<Vec<_>>(),
        "long_term": long_term.iter().map(|e| json!({
            "id": e.id,
            "category": e.category,
            "content": e.content,
            "tags": e.context_tags,
            "importance": e.importance,
            "access_count": e.access_count,
        })).collect::<Vec<_>>(),
    }))
}

/// Clear brain memory by category, or clear all short-term memory.
#[tauri::command]
pub async fn brain_clear_memory(
    state: State<'_, AppState>,
    category: Option<String>,
) -> Result<Value, String> {
    let mut brain = state.agent_brain.lock().await;

    match category.as_deref() {
        Some("short_term") | None => {
            brain.memory.clear_short_term();
            Ok(json!({ "success": true, "cleared": "short_term" }))
        }
        Some("all") => {
            brain.memory.clear_short_term();
            // Decay all long-term memories
            let db = state.db.clone();
            let decayed = brain
                .memory
                .decay_memories(&db, 0, u32::MAX)
                .map_err(|e| e.to_string())?;
            Ok(json!({ "success": true, "cleared": "all", "long_term_removed": decayed }))
        }
        Some(cat) => Ok(json!({ "success": false, "error": format!("Unknown category: {}", cat) })),
    }
}
