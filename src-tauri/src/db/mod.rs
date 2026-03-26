pub mod migrations;

use rusqlite::Connection;
use tauri::AppHandle;

use crate::config::paths;

/// Initialize the SQLite database and run migrations.
pub fn init_db(app: &AppHandle) -> Result<Connection, String> {
    let db_path = paths::db_path(app)?;
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    migrations::run_migrations(&conn).map_err(|e| format!("Migration failed: {}", e))?;

    Ok(conn)
}
