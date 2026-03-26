use std::collections::HashMap;

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::State;

use crate::mcp::manager::McpServerConfig;
use crate::state::AppState;

/// Start an MCP server by its server_id. Reads the config from the database.
#[tauri::command]
pub async fn mcp_start_server(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<(), String> {
    // Load the server config from the database.
    let config = {
        let db = state.db.lock().unwrap();
        let mut stmt = db
            .prepare(
                "SELECT id, name, transport_type, command, args_json, url, env_json, enabled \
                 FROM mcp_servers WHERE id = ?1",
            )
            .map_err(|e| format!("DB prepare error: {}", e))?;

        stmt.query_row([&server_id], |row| {
            let args_json: String = row.get(4)?;
            let env_json: String = row.get(6)?;
            Ok(McpServerConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                transport_type: row.get(2)?,
                command: row.get(3)?,
                args: serde_json::from_str(&args_json).unwrap_or_default(),
                url: row.get(5)?,
                env: serde_json::from_str(&env_json).unwrap_or_default(),
                enabled: row.get::<_, i32>(7)? != 0,
            })
        })
        .map_err(|e| format!("Server '{}' not found in database: {}", server_id, e))?
    };

    let mut manager = state.mcp_manager.lock().await;
    manager
        .start_server(config)
        .await
        .map_err(|e| e.to_string())
}

/// Stop a running MCP server.
#[tauri::command]
pub async fn mcp_stop_server(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<(), String> {
    let mut manager = state.mcp_manager.lock().await;
    manager
        .stop_server(&server_id)
        .await
        .map_err(|e| e.to_string())
}

/// Call a tool on an MCP server.
#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, AppState>,
    server_id: String,
    tool_name: String,
    args: Value,
) -> Result<Value, String> {
    let manager = state.mcp_manager.lock().await;
    let result = manager
        .call_tool(&server_id, &tool_name, args)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(&result).map_err(|e| e.to_string())
}

/// List tools available on an MCP server.
#[tauri::command]
pub async fn mcp_list_tools(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<Value, String> {
    let manager = state.mcp_manager.lock().await;
    let result = manager
        .list_tools(&server_id)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(&result).map_err(|e| e.to_string())
}

/// List all configured MCP servers (from the database), along with connection status.
#[tauri::command]
pub async fn mcp_list_servers(state: State<'_, AppState>) -> Result<Value, String> {
    // Read from DB first, then drop the lock before any .await
    let db_rows: Vec<(String, String, String, String, String, Option<String>, String, i32)> = {
        let db = state.db.lock().unwrap();
        let mut stmt = db
            .prepare(
                "SELECT id, name, transport_type, command, args_json, url, env_json, enabled \
                 FROM mcp_servers",
            )
            .map_err(|e| format!("DB error: {}", e))?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?,
            ))
        })
        .map_err(|e| format!("DB query error: {}", e))?;
        let collected: Vec<_> = rows.filter_map(|r| r.ok()).collect();
        collected
    };

    let manager = state.mcp_manager.lock().await;
    let servers: Vec<Value> = db_rows
        .into_iter()
        .map(|(id, name, transport, command, args_json, url, env_json, enabled)| {
            let connected = manager.is_connected(&id);
            json!({
                "id": id,
                "name": name,
                "transport_type": transport,
                "command": command,
                "args": serde_json::from_str::<Value>(&args_json).unwrap_or(json!([])),
                "url": url,
                "env": serde_json::from_str::<Value>(&env_json).unwrap_or(json!({})),
                "enabled": enabled != 0,
                "connected": connected,
            })
        })
        .collect();

    Ok(json!({ "servers": servers }))
}

/// Add a new MCP server configuration to the database.
#[derive(Debug, Deserialize)]
pub struct AddServerInput {
    pub id: String,
    pub name: String,
    #[serde(default = "default_transport")]
    pub transport_type: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub url: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_transport() -> String {
    "stdio".to_string()
}
fn default_enabled() -> bool {
    true
}

#[tauri::command]
pub async fn mcp_add_server(
    state: State<'_, AppState>,
    config: AddServerInput,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let args_json = serde_json::to_string(&config.args).map_err(|e| e.to_string())?;
    let env_json = serde_json::to_string(&config.env).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT OR REPLACE INTO mcp_servers (id, name, transport_type, command, args_json, url, env_json, enabled) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            config.id,
            config.name,
            config.transport_type,
            config.command,
            args_json,
            config.url,
            env_json,
            config.enabled as i32,
        ],
    )
    .map_err(|e| format!("Failed to add server: {}", e))?;

    Ok(())
}

/// Remove an MCP server configuration. Stops the server if running.
#[tauri::command]
pub async fn mcp_remove_server(
    state: State<'_, AppState>,
    server_id: String,
) -> Result<(), String> {
    // Stop if running.
    {
        let mut manager = state.mcp_manager.lock().await;
        let _ = manager.stop_server(&server_id).await;
    }

    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM mcp_servers WHERE id = ?1", [&server_id])
        .map_err(|e| format!("Failed to remove server: {}", e))?;

    Ok(())
}
