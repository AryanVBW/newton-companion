use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Returns the application data directory, creating it if necessary.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    if !path.exists() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }

    Ok(path)
}

/// Returns the path to the SQLite database file.
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?;
    Ok(dir.join("newton_companion.db"))
}
