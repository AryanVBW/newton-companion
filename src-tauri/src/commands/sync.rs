use serde_json::{json, Value};
use tauri::{Emitter, State};

use crate::state::AppState;

const NEWTON_SERVER_ID: &str = "newton-school";
const MAX_RETRIES: u32 = 3;
/// Base delay between retries for generic errors (ms)
const RETRY_DELAY_MS: u64 = 1000;
/// Delay between retries specifically for 429 rate-limit errors (ms).
/// Actual wait = RATE_LIMIT_RETRY_DELAY_MS * (attempt + 1): 5s, 10s, 15s, 20s
const RATE_LIMIT_RETRY_DELAY_MS: u64 = 5000;
/// Throttle pause inserted between every distinct tool call (ms).
/// Keeps the Newton API from 429-ing on rapid sequential requests.
const INTER_REQUEST_DELAY_MS: u64 = 400;
const MAX_LECTURE_DETAILS: usize = 20;

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

/// Call a single MCP tool with retry logic.
/// Returns the extracted value on success, or null after all retries exhausted.
async fn call_tool_with_retry(
    state: &State<'_, AppState>,
    tool_name: &str,
    args: Value,
) -> Value {
    for attempt in 0..=MAX_RETRIES {
        let call_result = {
            let manager = state.mcp_manager.lock().await;
            manager
                .call_tool(NEWTON_SERVER_ID, tool_name, args.clone())
                .await
        };

        match call_result {
            Ok(result) => {
                if result.is_error {
                    // Check if the MCP-level error content signals a rate limit
                    let content_text = result
                        .content
                        .first()
                        .and_then(|c| c.text.as_deref())
                        .unwrap_or("");
                    let is_rate_limited = content_text.contains("429")
                        || content_text.contains("Too Many Requests");

                    log::warn!(
                        "Tool {} returned error (attempt {}/{}): {}",
                        tool_name,
                        attempt + 1,
                        MAX_RETRIES + 1,
                        content_text
                    );

                    if attempt < MAX_RETRIES {
                        let delay = if is_rate_limited {
                            RATE_LIMIT_RETRY_DELAY_MS * (attempt as u64 + 1)
                        } else {
                            RETRY_DELAY_MS * (attempt as u64 + 1)
                        };
                        if is_rate_limited {
                            log::warn!(
                                "Tool {} rate-limited — waiting {}ms before retry",
                                tool_name, delay
                            );
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                        continue;
                    }
                    // Still extract whatever content came back
                    return extract_tool_text(&result);
                }
                return extract_tool_text(&result);
            }
            Err(e) => {
                let err_str = e.to_string();
                // Don't retry parameter/schema errors — they'll always fail
                let is_param_error = err_str.contains("code -32602")
                    || err_str.contains("missing field")
                    || err_str.contains("deserialize parameters");
                // Detect HTTP 429 rate-limit responses from the Newton API
                let is_rate_limited = err_str.contains("429")
                    || err_str.contains("Too Many Requests");

                log::warn!(
                    "Tool {} failed (attempt {}/{}): {}",
                    tool_name,
                    attempt + 1,
                    MAX_RETRIES + 1,
                    e
                );

                if is_param_error {
                    log::warn!("Tool {} has parameter error — skipping retries", tool_name);
                    break;
                }

                if attempt < MAX_RETRIES {
                    let delay = if is_rate_limited {
                        RATE_LIMIT_RETRY_DELAY_MS * (attempt as u64 + 1)
                    } else {
                        RETRY_DELAY_MS * (attempt as u64 + 1)
                    };
                    if is_rate_limited {
                        log::warn!(
                            "Tool {} rate-limited (429) — waiting {}ms before retry",
                            tool_name, delay
                        );
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                    continue;
                }
            }
        }
    }
    json!(null)
}

/// Cache a tool result in the local SQLite database.
fn cache_tool_result(state: &State<'_, AppState>, tool_name: &str, args: &Value, value: &Value) {
    let response_str = serde_json::to_string(value).unwrap_or_else(|_| "null".to_string());
    let args_str = serde_json::to_string(args).unwrap_or_else(|_| "{}".to_string());
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT OR REPLACE INTO newton_data_cache (tool_name, args_json, response_json, fetched_at) \
         VALUES (?1, ?2, ?3, datetime('now'))",
        rusqlite::params![tool_name, args_str, response_str],
    )
    .ok();
}

/// Extract subject_hashes from list_courses response.
/// Expects: { "courses": [{ "subjects": [{ "subject_hash": "..." }] }] }
/// or an array of courses directly.
fn extract_subject_hashes(courses_data: &Value) -> Vec<String> {
    let mut hashes = Vec::new();

    let courses_array = if let Some(arr) = courses_data.as_array() {
        arr.clone()
    } else if let Some(arr) = courses_data.get("courses").and_then(|c| c.as_array()) {
        arr.clone()
    } else {
        return hashes;
    };

    for course in &courses_array {
        if let Some(subjects) = course.get("subjects").and_then(|s| s.as_array()) {
            for subject in subjects {
                if let Some(hash) = subject.get("subject_hash").and_then(|h| h.as_str()) {
                    if !hash.is_empty() && !hashes.contains(&hash.to_string()) {
                        hashes.push(hash.to_string());
                    }
                }
            }
        }
    }

    hashes
}

/// A lecture reference with both the lecture hash and its associated subject hash.
struct LectureRef {
    lecture_hash: String,
    subject_hash: String,
}

/// Extract (lecture_hash, subject_hash) pairs from get_recent_lectures response.
/// `get_lecture_details` requires both fields.
fn extract_lecture_refs(lectures_data: &Value) -> Vec<LectureRef> {
    let mut refs = Vec::new();
    let mut seen = std::collections::HashSet::new();

    let lectures_array = if let Some(arr) = lectures_data.as_array() {
        arr.clone()
    } else if let Some(arr) = lectures_data.get("lectures").and_then(|l| l.as_array()) {
        arr.clone()
    } else if let Some(arr) = lectures_data.get("data").and_then(|d| d.as_array()) {
        arr.clone()
    } else {
        return refs;
    };

    for lecture in &lectures_array {
        let lh = lecture
            .get("lecture_hash")
            .or_else(|| lecture.get("hash"))
            .or_else(|| lecture.get("id"))
            .and_then(|h| h.as_str());

        let sh = lecture
            .get("subject_hash")
            .or_else(|| lecture.get("subject_id"))
            .and_then(|h| h.as_str());

        if let (Some(lh), Some(sh)) = (lh, sh) {
            if !lh.is_empty() && !sh.is_empty() && seen.insert(lh.to_string()) {
                refs.push(LectureRef {
                    lecture_hash: lh.to_string(),
                    subject_hash: sh.to_string(),
                });
            }
        }
    }

    refs
}

/// Discover all tools from newton-mcp, call each one in phases, cache results in SQLite.
/// Phase 1: Base tools (no hashes needed)
/// Phase 2: Extract hashes from Phase 1 results
/// Phase 3: Deep-fetch dependent tools using extracted hashes
/// Emits "newton-sync-progress" events to the frontend for live status.
#[tauri::command]
pub async fn sync_all_newton_data(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    course_hash: Option<String>,
) -> Result<Value, String> {
    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "discovering_tools", "phase": 0, "done": 0, "total": 0 }),
    );

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

    log::info!("Newton MCP has {} tools: {:?}", tool_names.len(), tool_names);

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

    // ── PHASE 1: Base tools (no hashes needed) ────────────────────────────

    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "phase1_base", "phase": 1, "done": 0, "total": 0 }),
    );

    let ch = course_hash.unwrap_or_default();
    let course_args = if ch.is_empty() {
        json!({})
    } else {
        json!({ "course_hash": ch })
    };

    // Base tools and their arguments
    let base_tool_configs: Vec<(&str, Value)> = vec![
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

    // Tools that need hashes (handled in Phase 3) or are destructive
    let phase3_tools: Vec<&str> = vec![
        "get_assessments",
        "get_lecture_details",
        "get_subject_progress",
    ];
    let never_call: Vec<&str> = vec![
        "logout",
        "search_practice_questions", // needs user query, not auto-syncable
    ];

    // Build Phase 1 call list
    let known_base_names: Vec<&str> = base_tool_configs.iter().map(|(n, _)| *n).collect();
    let mut phase1_calls: Vec<(String, Value)> = base_tool_configs
        .into_iter()
        .filter(|(name, _)| tool_names.contains(&name.to_string()))
        .map(|(n, a)| (n.to_string(), a))
        .collect();

    // Future-proofing: call unknown tools with course_args
    for name in &tool_names {
        if !known_base_names.contains(&name.as_str())
            && !phase3_tools.contains(&name.as_str())
            && !never_call.contains(&name.as_str())
        {
            phase1_calls.push((name.clone(), course_args.clone()));
        }
    }

    let total_phase1 = phase1_calls.len();
    let mut results: serde_json::Map<String, Value> = serde_json::Map::new();
    let mut done = 0usize;

    log::info!("Phase 1: fetching {} base tools", total_phase1);

    for (tool_name, args) in &phase1_calls {
        let _ = app.emit(
            "newton-sync-progress",
            json!({
                "step": "fetching",
                "phase": 1,
                "tool": tool_name,
                "done": done,
                "total": total_phase1,
            }),
        );

        let value = call_tool_with_retry(&state, tool_name, args.clone()).await;
        cache_tool_result(&state, tool_name, args, &value);
        results.insert(tool_name.clone(), value);
        done += 1;
        // Throttle between requests to avoid hitting the Newton API rate limit
        tokio::time::sleep(std::time::Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
    }

    log::info!("Phase 1 complete: {} base tools fetched", done);

    // ── PHASE 2: Extract hashes from Phase 1 results ──────────────────────

    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "phase2_extracting_hashes", "phase": 2, "done": done, "total": done }),
    );

    let subject_hashes = if let Some(courses_data) = results.get("list_courses") {
        extract_subject_hashes(courses_data)
    } else {
        Vec::new()
    };

    let lecture_refs = if let Some(lectures_data) = results.get("get_recent_lectures") {
        let all_refs = extract_lecture_refs(lectures_data);
        // Limit lecture detail fetches to avoid hammering the API
        all_refs.into_iter().take(MAX_LECTURE_DETAILS).collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    log::info!(
        "Phase 2: extracted {} subject hashes, {} lecture refs",
        subject_hashes.len(),
        lecture_refs.len()
    );

    // ── PHASE 3: Deep-fetch dependent tools ───────────────────────────────

    let has_assessments = tool_names.contains(&"get_assessments".to_string());
    let has_subject_progress = tool_names.contains(&"get_subject_progress".to_string());
    let has_lecture_details = tool_names.contains(&"get_lecture_details".to_string());

    // Count total Phase 3 calls
    let mut phase3_total = 0usize;
    if has_assessments {
        phase3_total += subject_hashes.len();
    }
    if has_subject_progress {
        phase3_total += subject_hashes.len();
    }
    if has_lecture_details {
        phase3_total += lecture_refs.len();
    }

    if phase3_total > 0 {
        log::info!("Phase 3: deep-fetching {} dependent tool calls", phase3_total);

        let _ = app.emit(
            "newton-sync-progress",
            json!({
                "step": "phase3_deep_fetch",
                "phase": 3,
                "done": 0,
                "total": phase3_total,
            }),
        );

        let mut phase3_done = 0usize;

        // ── get_assessments per subject ──
        if has_assessments && !subject_hashes.is_empty() {
            let mut assessments_map = serde_json::Map::new();

            for subject_hash in &subject_hashes {
                let _ = app.emit(
                    "newton-sync-progress",
                    json!({
                        "step": "fetching",
                        "phase": 3,
                        "tool": "get_assessments",
                        "detail": subject_hash,
                        "done": phase3_done,
                        "total": phase3_total,
                    }),
                );

                let mut args = json!({ "subject_hash": subject_hash });
                if !ch.is_empty() {
                    args["course_hash"] = json!(ch);
                }

                let value = call_tool_with_retry(&state, "get_assessments", args).await;
                assessments_map.insert(subject_hash.clone(), value);
                phase3_done += 1;
                tokio::time::sleep(std::time::Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let aggregated = Value::Object(assessments_map);
            cache_tool_result(&state, "get_assessments", &json!({"_aggregated": true}), &aggregated);
            results.insert("get_assessments".to_string(), aggregated);
        }

        // ── get_subject_progress per subject ──
        if has_subject_progress && !subject_hashes.is_empty() {
            let mut progress_map = serde_json::Map::new();

            for subject_hash in &subject_hashes {
                let _ = app.emit(
                    "newton-sync-progress",
                    json!({
                        "step": "fetching",
                        "phase": 3,
                        "tool": "get_subject_progress",
                        "detail": subject_hash,
                        "done": phase3_done,
                        "total": phase3_total,
                    }),
                );

                let mut args = json!({ "subject_hash": subject_hash });
                if !ch.is_empty() {
                    args["course_hash"] = json!(ch);
                }

                let value = call_tool_with_retry(&state, "get_subject_progress", args).await;
                progress_map.insert(subject_hash.clone(), value);
                phase3_done += 1;
                tokio::time::sleep(std::time::Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let aggregated = Value::Object(progress_map);
            cache_tool_result(
                &state,
                "get_subject_progress",
                &json!({"_aggregated": true}),
                &aggregated,
            );
            results.insert("get_subject_progress".to_string(), aggregated);
        }

        // ── get_lecture_details per lecture (requires both lecture_hash + subject_hash) ──
        if has_lecture_details && !lecture_refs.is_empty() {
            let mut details_map = serde_json::Map::new();

            for lref in &lecture_refs {
                let _ = app.emit(
                    "newton-sync-progress",
                    json!({
                        "step": "fetching",
                        "phase": 3,
                        "tool": "get_lecture_details",
                        "detail": lref.lecture_hash,
                        "done": phase3_done,
                        "total": phase3_total,
                    }),
                );

                let args = json!({
                    "lecture_hash": lref.lecture_hash,
                    "subject_hash": lref.subject_hash,
                });

                let value = call_tool_with_retry(&state, "get_lecture_details", args).await;
                details_map.insert(lref.lecture_hash.clone(), value);
                phase3_done += 1;
                tokio::time::sleep(std::time::Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let aggregated = Value::Object(details_map);
            cache_tool_result(
                &state,
                "get_lecture_details",
                &json!({"_aggregated": true}),
                &aggregated,
            );
            results.insert("get_lecture_details".to_string(), aggregated);
        }

        done += phase3_done;
        log::info!("Phase 3 complete: {} dependent tool calls done", phase3_done);
    } else {
        log::info!("Phase 3: no dependent tools to fetch (no hashes extracted)");
    }

    // ── Done ──────────────────────────────────────────────────────────────

    let _ = app.emit(
        "newton-sync-progress",
        json!({ "step": "complete", "phase": 3, "done": done, "total": done }),
    );

    log::info!(
        "Newton data sync complete: {} total calls ({} base + {} deep)",
        done,
        total_phase1,
        done.saturating_sub(total_phase1)
    );

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
