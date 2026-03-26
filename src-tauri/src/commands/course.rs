use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

/// Get the currently selected course.
#[tauri::command]
pub async fn get_selected_course(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();
    let result = db.query_row(
        "SELECT course_hash, course_name, semester_name FROM selected_course WHERE id = 1",
        [],
        |row| {
            Ok(json!({
                "course_hash": row.get::<_, String>(0)?,
                "course_name": row.get::<_, String>(1)?,
                "semester_name": row.get::<_, Option<String>>(2)?,
            }))
        },
    );

    match result {
        Ok(val) => Ok(val),
        Err(_) => Ok(json!({ "course_hash": "", "course_name": "", "semester_name": null })),
    }
}

/// Set the selected course.
#[tauri::command]
pub async fn set_selected_course(
    state: State<'_, AppState>,
    course_hash: String,
    course_name: String,
    semester_name: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT OR REPLACE INTO selected_course (id, course_hash, course_name, semester_name) \
         VALUES (1, ?1, ?2, ?3)",
        rusqlite::params![course_hash, course_name, semester_name],
    )
    .map_err(|e| format!("DB error: {}", e))?;
    Ok(())
}

/// Fetch all course data in one shot by calling multiple MCP tools.
/// Returns a combined JSON with courses, overview, schedule, lectures, assignments, etc.
#[tauri::command]
pub async fn fetch_all_course_data(
    state: State<'_, AppState>,
    server_id: String,
    course_hash: Option<String>,
) -> Result<Value, String> {
    let manager = state.mcp_manager.lock().await;

    // 1. list_courses
    let courses = manager
        .call_tool(&server_id, "list_courses", json!({}))
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    let ch = course_hash.clone().unwrap_or_default();
    let args_with_course = if ch.is_empty() {
        json!({})
    } else {
        json!({ "course_hash": ch })
    };

    // 2. get_me
    let user_profile = manager
        .call_tool(&server_id, "get_me", json!({}))
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 3. get_course_overview
    let overview = manager
        .call_tool(&server_id, "get_course_overview", args_with_course.clone())
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 4. get_upcoming_schedule
    let schedule = manager
        .call_tool(&server_id, "get_upcoming_schedule", args_with_course.clone())
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 5. get_recent_lectures
    let recent_lectures = manager
        .call_tool(
            &server_id,
            "get_recent_lectures",
            if ch.is_empty() {
                json!({})
            } else {
                json!({ "course_hash": ch, "count": 20 })
            },
        )
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 6. get_assignments
    let assignments = manager
        .call_tool(&server_id, "get_assignments", args_with_course.clone())
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 7. get_leaderboard
    let leaderboard = manager
        .call_tool(&server_id, "get_leaderboard", args_with_course.clone())
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 8. get_question_of_the_day
    let qotd = manager
        .call_tool(
            &server_id,
            "get_question_of_the_day",
            args_with_course.clone(),
        )
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 9. get_arena_stats
    let arena_stats = manager
        .call_tool(&server_id, "get_arena_stats", args_with_course.clone())
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    // 10. get_calendar (next 30 days)
    let calendar = manager
        .call_tool(
            &server_id,
            "get_calendar",
            if ch.is_empty() {
                json!({ "days": 30 })
            } else {
                json!({ "course_hash": ch, "days": 30 })
            },
        )
        .await
        .map_err(|e| e.to_string())
        .unwrap_or_default();

    Ok(json!({
        "courses": courses,
        "user_profile": user_profile,
        "course_overview": overview,
        "upcoming_schedule": schedule,
        "recent_lectures": recent_lectures,
        "assignments": assignments,
        "leaderboard": leaderboard,
        "qotd": qotd,
        "arena_stats": arena_stats,
        "calendar": calendar,
    }))
}
