use serde_json::{json, Value};
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::mcp::manager::McpServerConfig;
use crate::state::AppState;
use std::collections::HashMap;

const NEWTON_MCP_PACKAGE: &str = "@newtonschool/newton-mcp";
const NEWTON_SERVER_ID: &str = "newton-school";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Public wrapper for use from other modules (e.g. MCP transport).
pub fn enriched_path_public() -> String {
    enriched_path()
}

/// Build a PATH that includes common Node/nvm/homebrew locations.
/// macOS GUI apps don't inherit the terminal's PATH, so we must add them.
fn enriched_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/default".to_string());
    let base_path =
        std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin:/usr/sbin:/sbin".to_string());

    let candidates: Vec<String> = vec![
        format!("{}/.nvm/versions/node", home),
        format!("{}/.volta/bin", home),
        format!("{}/.local/share/fnm/aliases/default/bin", home),
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        format!("{}/.bun/bin", home),
    ];

    let mut extra_dirs: Vec<String> = Vec::new();

    let nvm_base = format!("{}/.nvm/versions/node", home);
    if let Ok(entries) = std::fs::read_dir(&nvm_base) {
        let mut versions: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .map(|e| format!("{}/bin", e.path().display()))
            .collect();
        versions.sort();
        versions.reverse();
        extra_dirs.extend(versions);
    }

    for dir in &candidates {
        if dir.contains("/.nvm/versions/node") {
            continue;
        }
        if std::path::Path::new(dir).is_dir() {
            extra_dirs.push(dir.clone());
        }
    }

    if extra_dirs.is_empty() {
        return base_path;
    }

    format!("{}:{}", extra_dirs.join(":"), base_path)
}

/// Resolve how to run newton-mcp: direct binary or npx fallback.
async fn resolve_newton_cmd() -> (String, Vec<String>) {
    let path_env = enriched_path();

    if let Ok(output) = tokio::process::Command::new("which")
        .arg("newton-mcp")
        .env("PATH", &path_env)
        .output()
        .await
    {
        if output.status.success() {
            let bin = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !bin.is_empty() {
                log::info!("Found newton-mcp at: {}", bin);
                return (bin, vec![]);
            }
        }
    }

    if let Ok(output) = tokio::process::Command::new("which")
        .arg("npx")
        .env("PATH", &path_env)
        .output()
        .await
    {
        if output.status.success() {
            let npx = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !npx.is_empty() {
                log::info!("Using npx at: {}", npx);
                return (
                    npx,
                    vec!["-y".to_string(), format!("{}@latest", NEWTON_MCP_PACKAGE)],
                );
            }
        }
    }

    log::warn!("Could not find newton-mcp or npx, falling back to bare npx");
    (
        "npx".to_string(),
        vec!["-y".to_string(), format!("{}@latest", NEWTON_MCP_PACKAGE)],
    )
}

/// Detect the user's login shell.
fn user_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

/// Run a shell command string through the user's login shell.
/// This sources ~/.zshrc etc so newton-mcp is on PATH.
async fn run_shell_cmd(shell_cmd: &str) -> Result<(String, bool), String> {
    let shell = user_shell();
    let output = tokio::process::Command::new(&shell)
        .args(["-l", "-c", shell_cmd])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run shell command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout, stderr);
    Ok((combined, output.status.success()))
}

/// Run a newton-mcp subcommand through the login shell.
async fn run_newton_cmd(subcmd: &str) -> Result<String, String> {
    let (cmd, base_args) = resolve_newton_cmd().await;
    let mut full_cmd = cmd.clone();
    for arg in &base_args {
        full_cmd.push(' ');
        full_cmd.push_str(arg);
    }
    full_cmd.push(' ');
    full_cmd.push_str(subcmd);

    let (combined, _success) = run_shell_cmd(&full_cmd).await?;
    Ok(combined)
}

/// Save auth session to the app's local DB.
fn save_session_to_db(state: &AppState, user_name: &str, user_email: &str) {
    let db = state.db.lock().unwrap();
    db.execute(
        "INSERT OR REPLACE INTO newton_auth (id, user_name, user_email, linked_at) \
         VALUES (1, ?1, ?2, datetime('now'))",
        rusqlite::params![user_name, user_email],
    )
    .ok();
}

/// Clear auth session from the app's local DB.
fn clear_session_from_db(state: &AppState) {
    let db = state.db.lock().unwrap();
    db.execute(
        "UPDATE newton_auth SET access_token='', refresh_token='', user_name='', user_email='', linked_at='' WHERE id=1",
        [],
    )
    .ok();
    // Also clear cached data
    db.execute("DELETE FROM newton_data_cache", []).ok();
}

/// Check if we have a saved session in the local DB.
fn has_saved_session(state: &AppState) -> (bool, String, String) {
    let db = state.db.lock().unwrap();
    let result = db.query_row(
        "SELECT user_name, user_email, linked_at FROM newton_auth WHERE id = 1",
        [],
        |row| {
            let name: String = row.get(0)?;
            let email: String = row.get(1)?;
            let linked: String = row.get(2)?;
            Ok((name, email, linked))
        },
    );
    match result {
        Ok((name, email, linked)) if !linked.is_empty() => (true, name, email),
        _ => (false, String::new(), String::new()),
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Check if newton-mcp is installed and its auth status.
/// Also checks the local DB for a saved session.
#[tauri::command]
pub async fn check_newton_mcp(state: State<'_, AppState>) -> Result<Value, String> {
    // First check local DB
    let (has_session, saved_name, saved_email) = has_saved_session(&state);

    let combined = run_newton_cmd("status").await.unwrap_or_default();
    let authenticated = combined.contains("Authenticated");

    // If binary says authenticated, save/update session
    if authenticated && !has_session {
        save_session_to_db(&state, "", "");
    }

    Ok(json!({
        "installed": true,
        "authenticated": authenticated || has_session,
        "has_saved_session": has_session,
        "saved_name": saved_name,
        "saved_email": saved_email,
        "message": combined.trim()
    }))
}

/// Install @newtonschool/newton-mcp globally via the login shell.
#[tauri::command]
pub async fn install_newton_mcp() -> Result<Value, String> {
    let (combined, success) = run_shell_cmd(&format!("npm install -g {}", NEWTON_MCP_PACKAGE)).await?;
    Ok(json!({
        "success": success,
        "output": combined.trim()
    }))
}

/// Spawn `newton-mcp login`, read its stderr for the device code + URL,
/// keep the process alive (it blocks until user authorizes), and return
/// the code + URL to the frontend immediately.
#[tauri::command]
pub async fn newton_mcp_start_login(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    // Kill any existing login process
    {
        let mut slot = state.login_process.lock().await;
        if let Some(mut child) = slot.take() {
            let _ = child.kill().await;
        }
    }

    // Build the full login command string
    let (cmd, base_args) = resolve_newton_cmd().await;
    let mut full_cmd = cmd.clone();
    for arg in &base_args {
        full_cmd.push(' ');
        full_cmd.push_str(arg);
    }
    full_cmd.push_str(" login");

    // Spawn through the user's login shell so PATH is fully loaded
    let shell = user_shell();
    log::info!("Spawning login via: {} -l -c \"{}\"", shell, full_cmd);

    let mut child = tokio::process::Command::new(&shell)
        .args(["-l", "-c", &full_cmd])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn newton-mcp login: {}", e))?;

    // Drain stdout in the background so it doesn't block/break the pipe
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let mut stdout_reader = BufReader::new(stdout).lines();
            while let Ok(Some(_)) = stdout_reader.next_line().await {}
        });
    }

    // newton-mcp login writes its device code output to STDERR
    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture stderr")?;

    let mut reader = BufReader::new(stderr).lines();
    let mut url = String::new();
    let mut code = String::new();

    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(30);

    loop {
        let line_result = tokio::time::timeout_at(deadline, reader.next_line()).await;

        match line_result {
            Ok(Ok(Some(line))) => {
                log::info!("newton-mcp login: {}", line);
                let _ = app.emit("newton-login-output", &line);

                if line.contains("visit:") {
                    if let Some(u) = line.split("visit:").nth(1) {
                        url = u.trim().to_string();
                    }
                }

                if line.contains("enter the code:") || line.contains("code:") {
                    if let Some(c) = line.split("code:").last() {
                        let trimmed = c.trim().to_string();
                        if !trimmed.is_empty() {
                            code = trimmed;
                        }
                    }
                }

                if line.contains("Already authenticated") {
                    let _ = child.kill().await;
                    // Save session since we're authenticated
                    save_session_to_db(&state, "", "");
                    return Ok(json!({
                        "already_authenticated": true,
                        "message": line.trim()
                    }));
                }

                if !url.is_empty() && !code.is_empty() {
                    break;
                }
            }
            Ok(Ok(None)) => break,
            Ok(Err(e)) => {
                return Err(format!("Failed to read stderr: {}", e));
            }
            Err(_) => {
                let _ = child.kill().await;
                return Err("Timeout waiting for device code from newton-mcp".to_string());
            }
        }
    }

    if url.is_empty() || code.is_empty() {
        let _ = child.kill().await;
        return Err(format!(
            "Could not parse device code. url='{}' code='{}'",
            url, code
        ));
    }

    // Store the child process so we can poll it later
    {
        let mut slot = state.login_process.lock().await;
        *slot = Some(child);
    }

    // Keep reading stderr in a background task so the pipe doesn't break
    let app_bg = app.clone();
    tokio::spawn(async move {
        loop {
            match reader.next_line().await {
                Ok(Some(line)) => {
                    log::info!("newton-mcp login (bg): {}", line);
                    let _ = app_bg.emit("newton-login-output", &line);
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }
    });

    Ok(json!({
        "url": url,
        "code": code
    }))
}

/// Check if the login process has completed.
#[tauri::command]
pub async fn newton_mcp_poll_login(state: State<'_, AppState>) -> Result<Value, String> {
    let mut slot = state.login_process.lock().await;

    match slot.as_mut() {
        None => {
            // No login process running - check if already authenticated
            drop(slot);
            let combined = run_newton_cmd("status").await.unwrap_or_default();
            let authenticated = combined.contains("Authenticated");

            if authenticated {
                save_session_to_db(&state, "", "");
            }

            Ok(json!({
                "complete": authenticated,
                "success": authenticated,
                "reason": if authenticated { "already_authenticated" } else { "no_process" }
            }))
        }
        Some(child) => {
            match child.try_wait() {
                Ok(Some(exit_status)) => {
                    let success = exit_status.success();
                    *slot = None;

                    // If login succeeded, verify with status and save session
                    if success {
                        drop(slot);
                        let combined = run_newton_cmd("status").await.unwrap_or_default();
                        let authenticated = combined.contains("Authenticated");
                        if authenticated {
                            save_session_to_db(&state, "", "");
                        }
                        Ok(json!({
                            "complete": true,
                            "success": authenticated
                        }))
                    } else {
                        Ok(json!({
                            "complete": true,
                            "success": false
                        }))
                    }
                }
                Ok(None) => {
                    Ok(json!({
                        "complete": false
                    }))
                }
                Err(e) => {
                    *slot = None;
                    Err(format!("Failed to check login process: {}", e))
                }
            }
        }
    }
}

/// Cancel an in-progress login.
#[tauri::command]
pub async fn newton_mcp_cancel_login(state: State<'_, AppState>) -> Result<(), String> {
    let mut slot = state.login_process.lock().await;
    if let Some(mut child) = slot.take() {
        let _ = child.kill().await;
    }
    Ok(())
}

/// Check newton-mcp auth status.
/// Reads both stdout and stderr since newton-mcp writes to stderr.
/// Also checks local DB for saved sessions.
#[tauri::command]
pub async fn newton_mcp_status(state: State<'_, AppState>) -> Result<Value, String> {
    let (has_session, saved_name, saved_email) = has_saved_session(&state);

    let combined = run_newton_cmd("status").await.unwrap_or_default();

    if combined.contains("Authenticated") {
        let expires = combined
            .lines()
            .find(|l| l.contains("Expires"))
            .map(|l| l.trim().to_string())
            .unwrap_or_default();

        // Update session in DB
        save_session_to_db(&state, &saved_name, &saved_email);

        Ok(json!({
            "authenticated": true,
            "expires": expires,
            "saved_name": saved_name,
            "saved_email": saved_email,
        }))
    } else if has_session {
        // We have a saved session but binary says not authenticated.
        // Try auto-connecting anyway — the MCP server might still work.
        Ok(json!({
            "authenticated": true,
            "has_saved_session": true,
            "saved_name": saved_name,
            "saved_email": saved_email,
            "message": "Saved session (re-auth may be needed)"
        }))
    } else {
        Ok(json!({
            "authenticated": false,
            "message": combined.trim()
        }))
    }
}

/// Run `newton-mcp logout`.
#[tauri::command]
pub async fn newton_mcp_logout(state: State<'_, AppState>) -> Result<Value, String> {
    // Kill any login process
    {
        let mut slot = state.login_process.lock().await;
        if let Some(mut child) = slot.take() {
            let _ = child.kill().await;
        }
    }

    let combined = run_newton_cmd("logout").await.unwrap_or_default();

    // Clear local session
    clear_session_from_db(&state);

    // Stop MCP server
    let mut manager = state.mcp_manager.lock().await;
    let _ = manager.stop_server(NEWTON_SERVER_ID).await;

    Ok(json!({ "success": true, "message": combined.trim() }))
}

/// Start the newton-mcp MCP server and verify it's running.
#[tauri::command]
pub async fn auto_connect_newton(state: State<'_, AppState>) -> Result<Value, String> {
    let (cmd, base_args) = resolve_newton_cmd().await;

    // Ensure the server config exists in DB
    {
        let db = state.db.lock().unwrap();
        let args_json =
            serde_json::to_string(&base_args).unwrap_or_else(|_| "[]".to_string());

        db.execute(
            "INSERT OR REPLACE INTO mcp_servers (id, name, transport_type, command, args_json, url, env_json, enabled) \
             VALUES (?1, ?2, 'stdio', ?3, ?4, NULL, '{}', 1)",
            rusqlite::params![NEWTON_SERVER_ID, "Newton School", cmd, args_json],
        )
        .map_err(|e| format!("Failed to configure server: {}", e))?;
    }

    let config = McpServerConfig {
        id: NEWTON_SERVER_ID.to_string(),
        name: "Newton School".to_string(),
        transport_type: "stdio".to_string(),
        command: cmd,
        args: base_args,
        url: None,
        env: HashMap::new(),
        enabled: true,
    };

    let mut manager = state.mcp_manager.lock().await;

    if manager.is_connected(NEWTON_SERVER_ID) {
        return Ok(json!({ "connected": true, "already_running": true }));
    }

    match manager.start_server(config).await {
        Ok(()) => Ok(json!({ "connected": true })),
        Err(e) => Ok(json!({
            "connected": false,
            "reason": "start_failed",
            "error": e.to_string()
        })),
    }
}
