use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types for MCP communication
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl JsonRpcRequest {
    pub fn new(id: u64, method: &str, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl JsonRpcNotification {
    pub fn new(method: &str, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            method: method.to_string(),
            params,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    pub data: Option<Value>,
}

// ---------------------------------------------------------------------------
// MCP-specific types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCapabilities {
    #[serde(default)]
    pub tools: Option<Value>,
    #[serde(default)]
    pub resources: Option<Value>,
    #[serde(default)]
    pub prompts: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpInitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub capabilities: McpCapabilities,
    #[serde(rename = "serverInfo")]
    pub server_info: McpServerInfo,
    /// Server-provided instructions describing how to use its tools.
    /// Critical for Newton MCP which provides detailed platform context.
    #[serde(default)]
    pub instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolsListResult {
    pub tools: Vec<McpTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "mimeType", default)]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResourcesListResult {
    pub resources: Vec<McpResource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResourceContent {
    pub uri: String,
    #[serde(rename = "mimeType", default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub blob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResourceReadResult {
    pub contents: Vec<McpResourceContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolCallContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpToolCallResult {
    pub content: Vec<McpToolCallContent>,
    #[serde(rename = "isError", default)]
    pub is_error: bool,
}
