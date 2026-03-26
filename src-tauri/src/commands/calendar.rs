use serde::Deserialize;
use serde_json::{json, Value};
use tauri::State;

use crate::calendar::google::{GoogleAuthConfig, GoogleCalendarClient};
use crate::calendar::sync::{prepare_events, sync_prepared_events};
use crate::state::AppState;

/// Start Google OAuth flow - returns the auth URL to open in browser.
#[tauri::command]
pub async fn google_auth_start(
    state: State<'_, AppState>,
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    let config = GoogleAuthConfig {
        client_id: client_id.clone(),
        client_secret: client_secret.clone(),
    };

    // Save config to DB
    {
        let db = state.db.lock().unwrap();
        db.execute(
            "UPDATE google_auth SET client_id = ?1, client_secret = ?2 WHERE id = 1",
            rusqlite::params![client_id, client_secret],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    let mut gcal = state.google_calendar.lock().await;
    gcal.configure(config, None);
    gcal.get_auth_url().map_err(|e| e.to_string())
}

/// Handle the OAuth callback with the authorization code.
#[tauri::command]
pub async fn google_auth_callback(
    state: State<'_, AppState>,
    code: String,
) -> Result<(), String> {
    let tokens = {
        let mut gcal = state.google_calendar.lock().await;
        gcal.exchange_code(&code).await.map_err(|e| e.to_string())?
    };

    // Persist tokens to DB (separate lock scope)
    let db = state.db.lock().unwrap();
    db.execute(
        "UPDATE google_auth SET access_token = ?1, refresh_token = ?2, expires_at = ?3 WHERE id = 1",
        rusqlite::params![tokens.access_token, tokens.refresh_token, tokens.expires_at],
    )
    .map_err(|e| format!("DB error: {}", e))?;

    Ok(())
}

/// Check if Google Calendar is connected.
#[tauri::command]
pub async fn google_auth_status(state: State<'_, AppState>) -> Result<Value, String> {
    let gcal = state.google_calendar.lock().await;
    let connected = gcal.is_connected();
    drop(gcal);

    let has_tokens = if !connected {
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

    Ok(json!({ "connected": has_tokens }))
}

/// Disconnect Google Calendar.
#[tauri::command]
pub async fn google_auth_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    {
        let db = state.db.lock().unwrap();
        db.execute(
            "UPDATE google_auth SET access_token = '', refresh_token = '', expires_at = '' WHERE id = 1",
            [],
        )
        .map_err(|e| format!("DB error: {}", e))?;
    }

    let mut gcal = state.google_calendar.lock().await;
    *gcal = GoogleCalendarClient::new();
    Ok(())
}

#[derive(Deserialize)]
pub struct SyncRequest {
    pub events: Vec<Value>,
    pub course_name: String,
    pub email_reminder_minutes: Option<i32>,
}

/// Sync Newton events to Google Calendar.
#[tauri::command]
pub async fn sync_to_google_calendar(
    state: State<'_, AppState>,
    request: SyncRequest,
) -> Result<Value, String> {
    // 1. Prepare events (pure computation, no async)
    let prepared = prepare_events(&request.events, &request.course_name);

    // 2. Filter out already-synced events using DB
    let events_to_sync: Vec<_> = {
        let db = state.db.lock().unwrap();
        prepared
            .into_iter()
            .filter(|e| {
                let already: bool = db
                    .query_row(
                        "SELECT COUNT(*) > 0 FROM google_calendar_sync WHERE newton_event_id = ?1",
                        [&e.newton_event_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(false);
                !already
            })
            .collect()
    };

    // 3. Sync to Google Calendar (async, no DB)
    let results = {
        let gcal = state.google_calendar.lock().await;
        sync_prepared_events(&gcal, &events_to_sync, request.email_reminder_minutes).await
    };

    // 4. Record synced events in DB
    let synced_count = results.len() as u32;
    {
        let db = state.db.lock().unwrap();
        for (newton_id, gcal_id, event_type) in &results {
            let _ = db.execute(
                "INSERT OR REPLACE INTO google_calendar_sync \
                 (newton_event_id, google_event_id, event_type, course_name, last_synced) \
                 VALUES (?1, ?2, ?3, ?4, datetime('now'))",
                rusqlite::params![newton_id, gcal_id, event_type, request.course_name],
            );
        }
    }

    Ok(json!({ "synced_count": synced_count }))
}

/// Get sync status (how many events synced).
#[tauri::command]
pub async fn get_google_sync_status(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock().unwrap();

    let total: i32 = db
        .query_row("SELECT COUNT(*) FROM google_calendar_sync", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    let last_synced: String = db
        .query_row(
            "SELECT MAX(last_synced) FROM google_calendar_sync",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .unwrap_or(None)
        .unwrap_or_default();

    Ok(json!({
        "total_synced": total,
        "last_synced": last_synced,
    }))
}
