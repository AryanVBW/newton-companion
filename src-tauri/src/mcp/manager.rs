use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::AppError;
use crate::mcp::protocol::{
    McpInitializeResult, McpResourceReadResult, McpResourcesListResult, McpToolCallResult,
    McpToolsListResult,
};
use crate::mcp::transport::StdioTransport;

/// Configuration for a single MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub transport_type: String,
    pub command: String,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub env: HashMap<String, String>,
    pub enabled: bool,
}

/// Runtime state for a connected MCP server.
#[allow(dead_code)]
struct McpServerConnection {
    config: McpServerConfig,
    transport: StdioTransport,
    server_info: Option<McpInitializeResult>,
}

/// Manages the lifecycle of all MCP server connections.
pub struct McpManager {
    connections: HashMap<String, McpServerConnection>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    /// Start and initialize an MCP server from its config.
    pub async fn start_server(&mut self, config: McpServerConfig) -> Result<(), AppError> {
        let server_id = config.id.clone();

        // If already connected, stop the old one first.
        if self.connections.contains_key(&server_id) {
            self.stop_server(&server_id).await?;
        }

        // Spawn the child process.
        let transport =
            StdioTransport::spawn(&config.command, &config.args, &config.env).await?;

        // MCP initialize handshake.
        let init_params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "roots": { "listChanged": false }
            },
            "clientInfo": {
                "name": "newton-companion",
                "version": "0.1.0"
            }
        });

        let response = transport
            .send_request("initialize", Some(init_params))
            .await?;

        let server_info = if let Some(result) = response.result {
            Some(serde_json::from_value::<McpInitializeResult>(result).map_err(|e| {
                AppError::mcp(format!("Failed to parse initialize result: {}", e))
            })?)
        } else if let Some(err) = response.error {
            return Err(AppError::mcp(format!(
                "MCP initialize error: {} (code {})",
                err.message, err.code
            )));
        } else {
            None
        };

        // Send the initialized notification.
        transport
            .send_notification("notifications/initialized", None)
            .await?;

        self.connections.insert(
            server_id,
            McpServerConnection {
                config,
                transport,
                server_info,
            },
        );

        Ok(())
    }

    /// Stop a running MCP server.
    pub async fn stop_server(&mut self, server_id: &str) -> Result<(), AppError> {
        if let Some(mut conn) = self.connections.remove(server_id) {
            conn.transport.shutdown().await?;
        }
        Ok(())
    }

    /// List all tools exposed by a server.
    pub async fn list_tools(&self, server_id: &str) -> Result<McpToolsListResult, AppError> {
        let conn = self
            .connections
            .get(server_id)
            .ok_or_else(|| AppError::ServerNotRunning(server_id.to_string()))?;

        let response = conn.transport.send_request("tools/list", None).await?;

        if let Some(err) = response.error {
            return Err(AppError::mcp(format!(
                "tools/list error: {} (code {})",
                err.message, err.code
            )));
        }

        let result = response
            .result
            .ok_or_else(|| AppError::mcp("tools/list returned no result"))?;

        serde_json::from_value(result)
            .map_err(|e| AppError::mcp(format!("Failed to parse tools/list: {}", e)))
    }

    /// Invoke a tool on a server.
    pub async fn call_tool(
        &self,
        server_id: &str,
        tool_name: &str,
        arguments: Value,
    ) -> Result<McpToolCallResult, AppError> {
        let conn = self
            .connections
            .get(server_id)
            .ok_or_else(|| AppError::ServerNotRunning(server_id.to_string()))?;

        let params = json!({
            "name": tool_name,
            "arguments": arguments
        });

        let response = conn
            .transport
            .send_request("tools/call", Some(params))
            .await?;

        if let Some(err) = response.error {
            return Err(AppError::mcp(format!(
                "tools/call error: {} (code {})",
                err.message, err.code
            )));
        }

        let result = response
            .result
            .ok_or_else(|| AppError::mcp("tools/call returned no result"))?;

        serde_json::from_value(result)
            .map_err(|e| AppError::mcp(format!("Failed to parse tools/call result: {}", e)))
    }

    /// List resources exposed by a server.
    pub async fn list_resources(
        &self,
        server_id: &str,
    ) -> Result<McpResourcesListResult, AppError> {
        let conn = self
            .connections
            .get(server_id)
            .ok_or_else(|| AppError::ServerNotRunning(server_id.to_string()))?;

        let response = conn
            .transport
            .send_request("resources/list", None)
            .await?;

        if let Some(err) = response.error {
            return Err(AppError::mcp(format!(
                "resources/list error: {} (code {})",
                err.message, err.code
            )));
        }

        let result = response
            .result
            .ok_or_else(|| AppError::mcp("resources/list returned no result"))?;

        serde_json::from_value(result)
            .map_err(|e| AppError::mcp(format!("Failed to parse resources/list: {}", e)))
    }

    /// Read a resource by URI.
    pub async fn read_resource(
        &self,
        server_id: &str,
        uri: &str,
    ) -> Result<McpResourceReadResult, AppError> {
        let conn = self
            .connections
            .get(server_id)
            .ok_or_else(|| AppError::ServerNotRunning(server_id.to_string()))?;

        let params = json!({ "uri": uri });

        let response = conn
            .transport
            .send_request("resources/read", Some(params))
            .await?;

        if let Some(err) = response.error {
            return Err(AppError::mcp(format!(
                "resources/read error: {} (code {})",
                err.message, err.code
            )));
        }

        let result = response
            .result
            .ok_or_else(|| AppError::mcp("resources/read returned no result"))?;

        serde_json::from_value(result)
            .map_err(|e| AppError::mcp(format!("Failed to parse resources/read: {}", e)))
    }

    /// Get the server info from the initialize result.
    pub fn get_server_info(&self, server_id: &str) -> Option<&McpInitializeResult> {
        self.connections
            .get(server_id)
            .and_then(|c| c.server_info.as_ref())
    }

    /// Get server instructions (from the MCP initialize handshake).
    /// These describe how to use the server's tools.
    pub fn get_server_instructions(&self, server_id: &str) -> Option<&str> {
        self.connections
            .get(server_id)
            .and_then(|c| c.server_info.as_ref())
            .and_then(|info| info.instructions.as_deref())
    }

    /// Collect instructions from all connected servers.
    pub fn all_server_instructions(&self) -> Vec<(String, String)> {
        self.connections
            .iter()
            .filter_map(|(id, conn)| {
                conn.server_info
                    .as_ref()
                    .and_then(|info| info.instructions.as_ref())
                    .map(|instr| (id.clone(), instr.clone()))
            })
            .collect()
    }

    /// Check if a server is currently connected.
    pub fn is_connected(&self, server_id: &str) -> bool {
        self.connections.contains_key(server_id)
    }

    /// Get the list of currently connected server IDs.
    pub fn connected_server_ids(&self) -> Vec<String> {
        self.connections.keys().cloned().collect()
    }

    /// Shut down all connected servers.
    pub async fn shutdown_all(&mut self) {
        let ids: Vec<String> = self.connections.keys().cloned().collect();
        for id in ids {
            let _ = self.stop_server(&id).await;
        }
    }
}
