use serde_json::Value;
use tauri::State;

use crate::state::AppState;

/// Get all settings from the config table.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();

    let mut stmt = db
        .prepare("SELECT key, value FROM config")
        .map_err(|e| format!("DB error: {}", e))?;

    let settings: serde_json::Map<String, Value> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })
        .map_err(|e| format!("DB query error: {}", e))?
        .filter_map(|r| r.ok())
        .map(|(k, v)| {
            // Try to parse the value as JSON; fall back to string.
            let val = serde_json::from_str::<Value>(&v).unwrap_or(Value::String(v));
            (k, val)
        })
        .collect();

    Ok(Value::Object(settings))
}

/// Save settings to the config table. Expects a JSON object of key-value pairs.
#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: Value,
) -> Result<(), String> {
    let obj = settings
        .as_object()
        .ok_or_else(|| "Settings must be a JSON object".to_string())?;

    let db = state.db.lock().unwrap();

    for (key, value) in obj {
        let value_str = match value {
            Value::String(s) => s.clone(),
            other => serde_json::to_string(other).map_err(|e| e.to_string())?,
        };

        db.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value_str],
        )
        .map_err(|e| format!("Failed to save setting '{}': {}", key, e))?;
    }

    Ok(())
}
