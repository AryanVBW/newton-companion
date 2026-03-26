use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

/// Get the current onboarding state.
#[tauri::command]
pub async fn get_onboarding_state(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();

    let completed: bool = db
        .query_row(
            "SELECT completed FROM onboarding_state WHERE id = 1",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|v| v != 0)
        .unwrap_or(false);

    Ok(json!({ "completed": completed }))
}

/// Mark onboarding as complete.
#[tauri::command]
pub async fn complete_onboarding(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().unwrap();

    db.execute(
        "UPDATE onboarding_state SET completed = 1 WHERE id = 1",
        [],
    )
    .map_err(|e| format!("Failed to complete onboarding: {}", e))?;

    Ok(())
}
