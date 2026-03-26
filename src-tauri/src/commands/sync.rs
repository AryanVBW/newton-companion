use serde_json::{json, Value};
use tauri::{Emitter, State};

use crate::state::AppState;

const NEWTON_SERVER_ID: &str = "newton-school";

/// Helper: extract text content from an MCP tool call result.
fn extract_tool_text(result: &crate::mcp::protocol::McpToolCallResult) -> Value {
    if let Some(item) = result.content.first() {
        if let Some(text) = &item.text {
            if let Ok(parsed) = serde_json::from_str::<Value>(text) {
                return parsed;
            }
            return Value::String(text.clone());
        }
    }
    json!(null)
}

/// Discover all tools from newton-mcp, call each one, cache results in SQLite.
/// Emits "newton-sync-progress" events to the frontend for live status.
#[tauri::command]
pub async fn sync_all_newton_data(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    course_hash: Option<String>,
) -> Result<Value, String> {
    let _ = app.emit("newton-sync-progress", json!({ "step": "discovering_tools", "done": 0, "total": 0 }));

    // 1. Discover all available tools
    let tools = {
        let manager = state.mcp_manager.lock().await;
        if !manager.is_connected(NEWTON_SERVER_ID) {
            return Err("Newton MCP not connected".to_string());
        }
        manager
            .list_tools(NEWTON_SERVER_ID)
            .await
            .map_err(|e| format!("Failed to list tools: {}", e))?
    };

    let tool_names: Vec<String> = tools.tools.iter().map(|t| t.name.clone()).collect();
    let total = tool_names.len();

    log::info!("Newton MCP has {} tools: {:?}", total, tool_names);

    // Save tool definitions to DB
    {
        let db = state.db.lock().unwrap();
        for tool in &tools.tools {
            let schema_str =
                serde_json::to_string(&tool.input_schema).unwrap_or_else(|_| "{}".to_string());
            let desc = tool.description.clone().unwrap_or_default();
            db.execute(
                "INSERT OR REPLACE INTO newton_mcp_tools (name, description, input_schema) VALUES (?1, ?2, ?3)",
                rusqlite::params![tool.name, desc, schema_str],
            )
            .ok();
        }
    }

    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "fetching_data", "done": 0, "total": total }),
    );

    // 2. Build args for each tool
    let ch = course_hash.unwrap_or_default();
    let course_args = if ch.is_empty() {
        json!({})
    } else {
        json!({ "course_hash": ch })
    };

    // Known tools and the args they need
    let tool_configs: Vec<(&str, Value)> = vec![
        ("list_courses", json!({})),
        ("get_me", json!({})),
        ("get_course_overview", course_args.clone()),
        ("get_upcoming_schedule", course_args.clone()),
        (
            "get_recent_lectures",
            if ch.is_empty() {
                json!({ "count": 50 })
            } else {
                json!({ "course_hash": ch, "count": 50 })
            },
        ),
        ("get_assignments", course_args.clone()),
        ("get_leaderboard", course_args.clone()),
        ("get_question_of_the_day", course_args.clone()),
        ("get_arena_stats", course_args.clone()),
        (
            "get_calendar",
            if ch.is_empty() {
                json!({ "days": 60 })
            } else {
                json!({ "course_hash": ch, "days": 60 })
            },
        ),
    ];

    // Tools that require specific hashes we don't have yet — skip them
    let skip_tools: Vec<&str> = vec![
        "get_assessments",     // needs subject_hash
        "get_lecture_details",  // needs lecture_hash
        "get_subject_progress", // needs subject_hash
        "search_practice_questions", // needs a search query
        "logout",              // destructive — never auto-call
    ];

    // Also call any tools not in our known list (future-proofing)
    let known_names: Vec<&str> = tool_configs.iter().map(|(n, _)| *n).collect();
    let mut all_tool_calls: Vec<(String, Value)> = tool_configs
        .into_iter()
        .filter(|(name, _)| tool_names.contains(&name.to_string()))
        .map(|(n, a)| (n.to_string(), a))
        .collect();

    for name in &tool_names {
        if !known_names.contains(&name.as_str()) && !skip_tools.contains(&name.as_str()) {
            // Unknown tool — call it with empty args (best effort)
            all_tool_calls.push((name.clone(), course_args.clone()));
        }
    }

    // Remove skipped tools from the call list
    all_tool_calls.retain(|(name, _)| !skip_tools.contains(&name.as_str()));

    let total_calls = all_tool_calls.len();
    let mut results: serde_json::Map<String, Value> = serde_json::Map::new();
    let mut done = 0usize;

    // 3. Call each tool and cache result
    for (tool_name, args) in &all_tool_calls {
        let _ = app.emit(
            "newton-sync-progress",
            json!({ "step": "fetching", "tool": tool_name, "done": done, "total": total_calls }),
        );

        let call_result = {
            let manager = state.mcp_manager.lock().await;
            manager
                .call_tool(NEWTON_SERVER_ID, tool_name, args.clone())
                .await
        };

        let value = match call_result {
            Ok(result) => extract_tool_text(&result),
            Err(e) => {
                log::warn!("Tool {} failed: {}", tool_name, e);
                json!(null)
            }
        };

        // Cache in DB
        {
            let response_str =
                serde_json::to_string(&value).unwrap_or_else(|_| "null".to_string());
            let args_str =
                serde_json::to_string(args).unwrap_or_else(|_| "{}".to_string());
            let db = state.db.lock().unwrap();
            db.execute(
                "INSERT OR REPLACE INTO newton_data_cache (tool_name, args_json, response_json, fetched_at) \
                 VALUES (?1, ?2, ?3, datetime('now'))",
                rusqlite::params![tool_name, args_str, response_str],
            )
            .ok();
        }

        results.insert(tool_name.clone(), value);
        done += 1;
    }

    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "complete", "done": done, "total": total_calls }),
    );

    log::info!("Newton data sync complete: {} tools fetched", done);

    Ok(Value::Object(results))
}

/// Read all cached Newton data from the local SQLite database.
/// Returns instantly — no network calls.
#[tauri::command]
pub async fn get_cached_newton_data(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();

    let mut stmt = db
        .prepare("SELECT tool_name, response_json, fetched_at FROM newton_data_cache")
        .map_err(|e| format!("DB error: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let json_str: String = row.get(1)?;
            let fetched_at: String = row.get(2)?;
            Ok((name, json_str, fetched_at))
        })
        .map_err(|e| format!("DB error: {}", e))?;

    let mut data = serde_json::Map::new();
    let mut meta = serde_json::Map::new();

    for row in rows {
        if let Ok((name, json_str, fetched_at)) = row {
            let value: Value =
                serde_json::from_str(&json_str).unwrap_or(Value::Null);
            data.insert(name.clone(), value);
            meta.insert(name, Value::String(fetched_at));
        }
    }

    let has_data = !data.is_empty();
    Ok(json!({
        "data": Value::Object(data),
        "fetched_at": Value::Object(meta),
        "has_data": has_data,
    }))
}

/// Get the list of discovered newton-mcp tools.
#[tauri::command]
pub async fn get_newton_tools(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();

    let mut stmt = db
        .prepare("SELECT name, description, input_schema FROM newton_mcp_tools")
        .map_err(|e| format!("DB error: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let desc: String = row.get(1)?;
            let schema_str: String = row.get(2)?;
            Ok((name, desc, schema_str))
        })
        .map_err(|e| format!("DB error: {}", e))?;

    let mut tools = Vec::new();
    for row in rows {
        if let Ok((name, desc, schema_str)) = row {
            let schema: Value =
                serde_json::from_str(&schema_str).unwrap_or(json!({}));
            tools.push(json!({
                "name": name,
                "description": desc,
                "input_schema": schema,
            }));
        }
    }

    Ok(json!({ "tools": tools }))
}
