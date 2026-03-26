pub mod ai;
pub mod calendar;
pub mod commands;
pub mod config;
pub mod db;
pub mod error;
pub mod mcp;
pub mod state;

use tauri::Manager;

use crate::ai::providers::{AiConfig, AiProvider};
use crate::state::AppState;

/// Load the AI configuration from the database and apply it to the AppState.
fn load_ai_config_from_db(state: &AppState, db_conn: &rusqlite::Connection) {
    let result = db_conn.query_row(
        "SELECT provider, base_url, api_key, model_id, temperature FROM ai_config WHERE id = 1",
        [],
        |row| {
            Ok(AiConfig {
                provider: AiProvider::from_str_loose(&row.get::<_, String>(0)?),
                base_url: row.get(1)?,
                api_key: row.get(2)?,
                model_id: row.get(3)?,
                temperature: row.get(4)?,
            })
        },
    );

    if let Ok(config) = result {
        // ai_brain uses tokio::sync::Mutex but we can try_lock since nothing else holds it yet.
        if let Ok(mut brain) = state.ai_brain.try_lock() {
            brain.configure(config);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = db::init_db(app.handle())?;
            let state = AppState::new(db);

            // Load persisted AI config into the brain.
            {
                let db_ref = state.db.lock().unwrap();
                load_ai_config_from_db(&state, &db_ref);
            }

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // MCP commands
            commands::mcp::mcp_start_server,
            commands::mcp::mcp_stop_server,
            commands::mcp::mcp_call_tool,
            commands::mcp::mcp_list_tools,
            commands::mcp::mcp_list_servers,
            commands::mcp::mcp_add_server,
            commands::mcp::mcp_remove_server,
            // AI commands
            commands::ai::ai_chat,
            commands::ai::ai_configure,
            commands::ai::ai_get_config,
            commands::ai::ai_list_models,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            // Onboarding commands
            commands::onboarding::get_onboarding_state,
            commands::onboarding::complete_onboarding,
            // Calendar commands
            commands::calendar::google_auth_start,
            commands::calendar::google_auth_callback,
            commands::calendar::google_auth_status,
            commands::calendar::google_auth_disconnect,
            commands::calendar::sync_to_google_calendar,
            commands::calendar::get_google_sync_status,
            // Course commands
            commands::course::get_selected_course,
            commands::course::set_selected_course,
            commands::course::fetch_all_course_data,
            // Newton auth commands
            commands::newton_auth::check_newton_mcp,
            commands::newton_auth::install_newton_mcp,
            commands::newton_auth::newton_mcp_start_login,
            commands::newton_auth::newton_mcp_poll_login,
            commands::newton_auth::newton_mcp_cancel_login,
            commands::newton_auth::newton_mcp_status,
            commands::newton_auth::newton_mcp_logout,
            commands::newton_auth::auto_connect_newton,
            // Data sync commands
            commands::sync::sync_all_newton_data,
            commands::sync::get_cached_newton_data,
            commands::sync::get_newton_tools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
