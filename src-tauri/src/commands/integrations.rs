use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

use crate::mcp::manager::McpServerConfig;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub id: String,
    pub provider: String,
    pub api_key: String,
    pub enabled: bool,
    pub config_json: Value,
}

/// Save an integration configuration and optionally auto-connect its MCP server.
#[tauri::command]
pub async fn save_integration(
    state: State<'_, AppState>,
    id: String,
    provider: String,
    api_key: String,
    config: Option<Value>,
) -> Result<(), String> {
    let config_json = config.unwrap_or(json!({}));

    // Save to DB
    {
        let db = state.db.lock().unwrap();
        db.execute(
            "INSERT OR REPLACE INTO integrations (id, provider, api_key, enabled, config_json, updated_at) \
             VALUES (?1, ?2, ?3, 1, ?4, datetime('now'))",
            rusqlite::params![
                id,
                provider,
                api_key,
                serde_json::to_string(&config_json).unwrap_or_default()
            ],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    // Auto-connect MCP server for the integration
    if !api_key.is_empty() {
        match provider.as_str() {
            "notion" => {
                auto_connect_notion_mcp(&state, &api_key).await?;
            }
            "gdocs" => {
                // Google Docs MCP could be auto-connected here in the future
            }
            _ => {}
        }
    }

    Ok(())
}

/// Get all integration configurations.
#[tauri::command]
pub async fn get_integrations(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare(
            "SELECT id, provider, api_key, enabled, config_json FROM integrations ORDER BY provider",
        )
        .map_err(|e| format!("DB error: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "provider": row.get::<_, String>(1)?,
                "has_key": !row.get::<_, String>(2)?.is_empty(),
                "enabled": row.get::<_, bool>(3)?,
                "config": serde_json::from_str::<Value>(
                    &row.get::<_, String>(4).unwrap_or_default()
                ).unwrap_or(json!({})),
            }))
        })
        .map_err(|e| format!("DB error: {}", e))?;

    let mut integrations = Vec::new();
    for row in rows {
        if let Ok(v) = row {
            integrations.push(v);
        }
    }

    Ok(integrations)
}

/// Remove an integration.
#[tauri::command]
pub async fn remove_integration(
    state: State<'_, AppState>,
    id: String,
    provider: String,
) -> Result<(), String> {
    // Remove from DB
    {
        let db = state.db.lock().unwrap();
        db.execute("DELETE FROM integrations WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| format!("DB error: {}", e))?;
    }

    // Disconnect the MCP server if running
    let mcp_server_id = format!("integration-{}", provider);
    let mut mcp = state.mcp_manager.lock().await;
    if mcp.is_connected(&mcp_server_id) {
        let _ = mcp.stop_server(&mcp_server_id).await;
    }

    Ok(())
}

/// Get the connection status of all integrations.
#[tauri::command]
pub async fn get_integration_status(state: State<'_, AppState>) -> Result<Value, String> {
    let gcal = state.google_calendar.lock().await;
    let calendar_connected = gcal.is_connected();
    drop(gcal);

    // Check if calendar has tokens in DB
    let calendar_has_tokens = if !calendar_connected {
        let db = state.db.lock().unwrap();
        db.query_row(
            "SELECT LENGTH(access_token) > 0 FROM google_auth WHERE id = 1",
            [],
            |row| row.get::<_, bool>(0),
        )
        .unwrap_or(false)
    } else {
        true
    };

    let mcp = state.mcp_manager.lock().await;
    let notion_connected = mcp.is_connected("integration-notion");
    let gdocs_connected = mcp.is_connected("integration-gdocs");
    drop(mcp);

    // Check if integrations have keys
    let (notion_has_key, gdocs_has_key) = {
        let db = state.db.lock().unwrap();
        let notion = db
            .query_row(
                "SELECT LENGTH(api_key) > 0 FROM integrations WHERE provider = 'notion'",
                [],
                |row| row.get::<_, bool>(0),
            )
            .unwrap_or(false);
        let gdocs = db
            .query_row(
                "SELECT LENGTH(api_key) > 0 FROM integrations WHERE provider = 'gdocs'",
                [],
                |row| row.get::<_, bool>(0),
            )
            .unwrap_or(false);
        (notion, gdocs)
    };

    Ok(json!({
        "google_calendar": {
            "configured": calendar_has_tokens,
            "connected": calendar_connected || calendar_has_tokens,
        },
        "notion": {
            "configured": notion_has_key,
            "connected": notion_connected,
        },
        "gdocs": {
            "configured": gdocs_has_key,
            "connected": gdocs_connected,
        }
    }))
}

/// Auto-connect integrations that have saved configs on app startup.
pub async fn auto_connect_integrations(state: &AppState) {
    // Load Notion integration
    let notion_key = {
        let db = state.db.lock().unwrap();
        db.query_row(
            "SELECT api_key FROM integrations WHERE provider = 'notion' AND enabled = 1 AND LENGTH(api_key) > 0",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
    };

    if let Some(api_key) = notion_key {
        if let Err(e) = auto_connect_notion_mcp_internal(state, &api_key).await {
            tracing::warn!("Failed to auto-connect Notion MCP: {}", e);
        }
    }

    // Load Google Calendar tokens from DB and configure the client
    {
        let db = state.db.lock().unwrap();
        let result = db.query_row(
            "SELECT access_token, refresh_token, expires_at, client_id, client_secret \
             FROM google_auth WHERE id = 1 AND LENGTH(access_token) > 0",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            },
        );

        if let Ok((access_token, refresh_token, expires_at, client_id, client_secret)) = result {
            if !access_token.is_empty() {
                // Must drop db before async lock
                drop(db);
                let mut gcal = state.google_calendar.try_lock().unwrap();
                gcal.configure(
                    crate::calendar::google::GoogleAuthConfig {
                        client_id,
                        client_secret,
                    },
                    Some(crate::calendar::google::GoogleTokens {
                        access_token,
                        refresh_token,
                        expires_at,
                    }),
                );
            }
        }
    }
}

/// Auto-connect Notion MCP server with the given API key.
async fn auto_connect_notion_mcp(state: &AppState, api_key: &str) -> Result<(), String> {
    auto_connect_notion_mcp_internal(state, api_key).await
}

async fn auto_connect_notion_mcp_internal(state: &AppState, api_key: &str) -> Result<(), String> {
    let server_id = "integration-notion".to_string();

    let mut mcp = state.mcp_manager.lock().await;

    // Don't reconnect if already connected
    if mcp.is_connected(&server_id) {
        return Ok(());
    }

    let mut env = std::collections::HashMap::new();
    env.insert("OPENAPI_MCP_HEADERS".to_string(), format!(
        "{{\"Authorization\": \"Bearer {}\", \"Notion-Version\": \"2022-06-28\"}}",
        api_key
    ));
    env.insert("NOTION_API_KEY".to_string(), api_key.to_string());

    let config = McpServerConfig {
        id: server_id,
        name: "Notion".to_string(),
        transport_type: "stdio".to_string(),
        command: "npx".to_string(),
        args: vec![
            "-y".to_string(),
            "@notionhq/notion-mcp-server".to_string(),
        ],
        url: None,
        env,
        enabled: true,
    };

    mcp.start_server(config)
        .await
        .map_err(|e| format!("Failed to start Notion MCP: {}", e))?;

    tracing::info!("Notion MCP server connected successfully");
    Ok(())
}
