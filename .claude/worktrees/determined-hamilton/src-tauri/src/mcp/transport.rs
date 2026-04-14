use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex};

use crate::error::AppError;
use crate::mcp::protocol::{JsonRpcNotification, JsonRpcRequest, JsonRpcResponse};

/// Manages a single MCP server child process and its stdin/stdout communication.
pub struct StdioTransport {
    child: Child,
    writer: Arc<Mutex<tokio::process::ChildStdin>>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>,
    next_id: Arc<Mutex<u64>>,
    reader_handle: tokio::task::JoinHandle<()>,
}

impl StdioTransport {
    /// Spawn a child process and start the stdout reader loop.
    pub async fn spawn(
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
    ) -> Result<Self, AppError> {
        // Spawn through the user's login shell so their full PATH is loaded.
        // Build the full command string: "command arg1 arg2 ..."
        let mut full_cmd = command.to_string();
        for arg in args {
            full_cmd.push(' ');
            // Simple shell escaping for args with spaces
            if arg.contains(' ') || arg.contains('@') {
                full_cmd.push('"');
                full_cmd.push_str(arg);
                full_cmd.push('"');
            } else {
                full_cmd.push_str(arg);
            }
        }

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        log::info!("Spawning MCP server via: {} -l -c \"{}\"", shell, full_cmd);

        let mut cmd = Command::new(&shell);
        cmd.args(["-l", "-c", &full_cmd])
            .envs(env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            AppError::transport(format!(
                "Failed to spawn MCP server '{}': {}",
                command, e
            ))
        })?;

        let stdin = child.stdin.take().ok_or_else(|| {
            AppError::transport("Failed to capture child stdin")
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::transport("Failed to capture child stdout")
        })?;

        let writer = Arc::new(Mutex::new(stdin));
        let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        // Spawn a background task to read stdout line-by-line and dispatch responses.
        let pending_clone = pending.clone();
        let reader_handle = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                match serde_json::from_str::<JsonRpcResponse>(trimmed) {
                    Ok(response) => {
                        if let Some(id) = response.id {
                            let mut map = pending_clone.lock().await;
                            if let Some(sender) = map.remove(&id) {
                                let _ = sender.send(response);
                            }
                        }
                        // Notifications (id == None) are silently ignored for now.
                    }
                    Err(_) => {
                        // Non-JSON lines from the server are ignored (e.g. debug output).
                        tracing::debug!("Ignoring non-JSON stdout line: {}", trimmed);
                    }
                }
            }

            tracing::info!("MCP server stdout reader loop ended");
        });

        Ok(Self {
            child,
            writer,
            pending,
            next_id: Arc::new(Mutex::new(1)),
            reader_handle,
        })
    }

    /// Send a JSON-RPC request and wait for the matching response.
    pub async fn send_request(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<JsonRpcResponse, AppError> {
        let id = {
            let mut counter = self.next_id.lock().await;
            let id = *counter;
            *counter += 1;
            id
        };

        let request = JsonRpcRequest::new(id, method, params);
        let (tx, rx) = oneshot::channel();

        {
            let mut map = self.pending.lock().await;
            map.insert(id, tx);
        }

        let payload = serde_json::to_string(&request)
            .map_err(|e| AppError::transport(format!("Failed to serialize request: {}", e)))?;

        {
            let mut writer = self.writer.lock().await;
            writer
                .write_all(payload.as_bytes())
                .await
                .map_err(|e| AppError::transport(format!("Failed to write to stdin: {}", e)))?;
            writer
                .write_all(b"\n")
                .await
                .map_err(|e| AppError::transport(format!("Failed to write newline: {}", e)))?;
            writer
                .flush()
                .await
                .map_err(|e| AppError::transport(format!("Failed to flush stdin: {}", e)))?;
        }

        // Wait for the response with a timeout.
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => Err(AppError::transport("Response channel closed unexpectedly")),
            Err(_) => {
                // Clean up the pending entry on timeout.
                let mut map = self.pending.lock().await;
                map.remove(&id);
                Err(AppError::Timeout(format!(
                    "Request '{}' (id={}) timed out after 30s",
                    method, id
                )))
            }
        }
    }

    /// Send a JSON-RPC notification (no response expected).
    pub async fn send_notification(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), AppError> {
        let notification = JsonRpcNotification::new(method, params);
        let payload = serde_json::to_string(&notification)
            .map_err(|e| AppError::transport(format!("Failed to serialize notification: {}", e)))?;

        let mut writer = self.writer.lock().await;
        writer
            .write_all(payload.as_bytes())
            .await
            .map_err(|e| AppError::transport(format!("Failed to write notification: {}", e)))?;
        writer
            .write_all(b"\n")
            .await
            .map_err(|e| AppError::transport(format!("Failed to write newline: {}", e)))?;
        writer
            .flush()
            .await
            .map_err(|e| AppError::transport(format!("Failed to flush stdin: {}", e)))?;

        Ok(())
    }

    /// Check whether the child process is still running.
    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    /// Kill the child process and clean up.
    pub async fn shutdown(&mut self) -> Result<(), AppError> {
        self.reader_handle.abort();
        self.child
            .kill()
            .await
            .map_err(|e| AppError::transport(format!("Failed to kill child process: {}", e)))?;
        Ok(())
    }
}
