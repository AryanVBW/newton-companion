use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

use crate::ai::types::{AvailableTool, ToolExecutionResult};
use crate::error::AppError;
use crate::mcp::manager::McpManager;

// ---------------------------------------------------------------------------
// ToolRouter — discovers tools, routes calls, handles errors
// ---------------------------------------------------------------------------

pub struct ToolRouter {
    /// Cache of discovered tools, keyed by tool name
    tool_cache: HashMap<String, AvailableTool>,
    /// When the cache was last refreshed
    cache_refreshed_at: Option<Instant>,
    /// Cache TTL in seconds
    cache_ttl_seconds: u64,
}

impl ToolRouter {
    pub fn new() -> Self {
        Self {
            tool_cache: HashMap::new(),
            cache_refreshed_at: None,
            cache_ttl_seconds: 60,
        }
    }

    /// Discover all available tools from all connected MCP servers.
    pub async fn discover_tools(
        &mut self,
        mcp_manager: &Arc<Mutex<McpManager>>,
    ) -> Result<Vec<AvailableTool>, AppError> {
        let manager = mcp_manager.lock().await;
        let server_ids = manager.connected_server_ids();

        let mut tools = Vec::new();
        self.tool_cache.clear();

        for sid in &server_ids {
            match manager.list_tools(sid).await {
                Ok(tools_result) => {
                    for tool in &tools_result.tools {
                        let available = AvailableTool {
                            name: tool.name.clone(),
                            description: tool.description.clone().unwrap_or_default(),
                            server_id: sid.clone(),
                            server_name: sid.clone(), // Could map to display name
                            input_schema: tool.input_schema.clone(),
                        };
                        self.tool_cache.insert(tool.name.clone(), available.clone());
                        tools.push(available);
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to list tools for server {}: {}", sid, e);
                }
            }
        }

        self.cache_refreshed_at = Some(Instant::now());
        Ok(tools)
    }

    /// Get cached tools, refreshing if stale.
    pub async fn get_tools(
        &mut self,
        mcp_manager: &Arc<Mutex<McpManager>>,
    ) -> Result<Vec<AvailableTool>, AppError> {
        let needs_refresh = match self.cache_refreshed_at {
            None => true,
            Some(t) => t.elapsed().as_secs() > self.cache_ttl_seconds,
        };

        if needs_refresh {
            self.discover_tools(mcp_manager).await
        } else {
            Ok(self.tool_cache.values().cloned().collect())
        }
    }

    /// Get a list of tool names.
    pub fn tool_names(&self) -> Vec<String> {
        self.tool_cache.keys().cloned().collect()
    }

    /// Find which server hosts a given tool.
    pub fn find_server(&self, tool_name: &str) -> Option<&AvailableTool> {
        self.tool_cache.get(tool_name)
    }

    /// Execute a tool call, routing to the correct MCP server.
    pub async fn execute_tool(
        &self,
        mcp_manager: &Arc<Mutex<McpManager>>,
        tool_name: &str,
        arguments: Value,
    ) -> ToolExecutionResult {
        let start = Instant::now();

        let tool_info = match self.tool_cache.get(tool_name) {
            Some(info) => info,
            None => {
                return ToolExecutionResult {
                    tool_name: tool_name.to_string(),
                    server_id: String::new(),
                    output: String::new(),
                    success: false,
                    error: Some(format!("Unknown tool: {}", tool_name)),
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        };

        let server_id = tool_info.server_id.clone();

        let result = {
            let manager = mcp_manager.lock().await;
            manager.call_tool(&server_id, tool_name, arguments).await
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(tool_result) => {
                let output: String = tool_result
                    .content
                    .iter()
                    .filter_map(|c| c.text.as_ref())
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("\n");

                ToolExecutionResult {
                    tool_name: tool_name.to_string(),
                    server_id,
                    output,
                    success: true,
                    error: None,
                    duration_ms,
                }
            }
            Err(e) => ToolExecutionResult {
                tool_name: tool_name.to_string(),
                server_id,
                output: String::new(),
                success: false,
                error: Some(e.to_string()),
                duration_ms,
            },
        }
    }

    /// Try executing a tool, falling back to alternative tools if the primary fails.
    pub async fn execute_with_fallback(
        &self,
        mcp_manager: &Arc<Mutex<McpManager>>,
        tool_name: &str,
        arguments: Value,
        alternatives: &[(&str, Value)],
    ) -> ToolExecutionResult {
        // Try primary tool
        let result = self.execute_tool(mcp_manager, tool_name, arguments).await;
        if result.success {
            return result;
        }

        tracing::warn!(
            "Primary tool '{}' failed: {:?}. Trying alternatives...",
            tool_name,
            result.error
        );

        // Try alternatives
        for (alt_name, alt_args) in alternatives {
            let alt_result = self
                .execute_tool(mcp_manager, alt_name, alt_args.clone())
                .await;
            if alt_result.success {
                tracing::info!("Fallback tool '{}' succeeded", alt_name);
                return alt_result;
            }
        }

        // All failed, return original error
        result
    }

    /// Convert cached tools to OpenAI function-calling format for LLM use.
    pub fn tools_as_openai_functions(&self) -> Vec<Value> {
        self.tool_cache
            .values()
            .map(|tool| {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema
                    }
                })
            })
            .collect()
    }
}
