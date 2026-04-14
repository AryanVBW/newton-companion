use serde_json::{json, Value};
use tauri::State;

use crate::ai::brain::{AiBrain, ChatMessage};
use crate::ai::providers::{AiConfig, AiProvider};
use crate::state::AppState;

/// Send a chat message and get a response. Supports tool-use loop with MCP servers.
#[tauri::command]
pub async fn ai_chat(
    state: State<'_, AppState>,
    message: String,
    history: Option<Vec<ChatMessage>>,
) -> Result<Value, String> {
    // Build the message list.
    let mut messages = history.unwrap_or_default();
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: Some(message),
        tool_calls: None,
        tool_call_id: None,
    });

    // Collect MCP tools from all connected servers.
    let (tools_openai, tool_server_map) = {
        let manager = state.mcp_manager.lock().await;
        let server_ids = manager.connected_server_ids();
        let mut all_tools = Vec::new();
        let mut tool_map: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();

        for sid in &server_ids {
            if let Ok(tools_result) = manager.list_tools(sid).await {
                let openai_fns = AiBrain::mcp_tools_to_openai_functions(&tools_result.tools);
                for tool in &tools_result.tools {
                    tool_map.insert(tool.name.clone(), sid.clone());
                }
                all_tools.extend(openai_fns);
            }
        }

        (all_tools, tool_map)
    };

    // Clone what we need outside the lock so we can release it during the tool loop.
    let ai_brain = state.ai_brain.lock().await;
    let config = ai_brain.get_config().clone();
    drop(ai_brain);

    // Build a temporary brain with the same config to drive the loop.
    let brain = {
        let mut b = AiBrain::new();
        b.configure(config);
        b
    };

    let mcp_manager = state.mcp_manager.clone();
    let tool_server_map_clone = tool_server_map.clone();

    let (response_text, final_messages) = brain
        .chat_with_tools(messages, &tools_openai, |tool_name, arguments_str| {
            let mgr = mcp_manager.clone();
            let tsm = tool_server_map_clone.clone();
            async move {
                let server_id = tsm.get(&tool_name).ok_or_else(|| {
                    crate::error::AppError::mcp(format!(
                        "No server found for tool '{}'",
                        tool_name
                    ))
                })?;

                let args: Value =
                    serde_json::from_str(&arguments_str).unwrap_or(Value::Object(Default::default()));

                let manager = mgr.lock().await;
                let result = manager.call_tool(server_id, &tool_name, args).await?;

                // Concatenate all text content from the tool result.
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
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "response": response_text,
        "messages": final_messages,
    }))
}

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
        let mut brain = state.ai_brain.lock().await;
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
    let brain = state.ai_brain.lock().await;
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
