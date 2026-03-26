use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::ai::providers::{AiConfig, AiProvider};
use crate::error::AppError;
use crate::mcp::protocol::McpTool;

// ---------------------------------------------------------------------------
// OpenAI-compatible API types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub choices: Vec<ChatChoice>,
    #[serde(default)]
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ---------------------------------------------------------------------------
// AiBrain - the OpenAI-compatible HTTP client
// ---------------------------------------------------------------------------

pub struct AiBrain {
    client: Client,
    config: AiConfig,
}

impl AiBrain {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            config: AiConfig::default(),
        }
    }

    pub fn configure(&mut self, config: AiConfig) {
        self.config = config;
    }

    pub fn get_config(&self) -> &AiConfig {
        &self.config
    }

    /// Convert MCP tool definitions into the OpenAI function-calling format.
    pub fn mcp_tools_to_openai_functions(tools: &[McpTool]) -> Vec<Value> {
        tools
            .iter()
            .map(|tool| {
                json!({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description.clone().unwrap_or_default(),
                        "parameters": tool.input_schema
                    }
                })
            })
            .collect()
    }

    /// Send a chat completion request (non-streaming).
    /// Returns the full response including any tool_calls the model wants to make.
    pub async fn chat_completion(
        &self,
        messages: &[ChatMessage],
        tools: Option<&[Value]>,
    ) -> Result<ChatCompletionResponse, AppError> {
        if self.config.api_key.is_empty() {
            return Err(AppError::ai(
                "AI API key is not configured. Please set it in Settings.",
            ));
        }

        let url = format!("{}/chat/completions", self.config.base_url.trim_end_matches('/'));

        let mut body = json!({
            "model": self.config.model_id,
            "messages": messages,
            "temperature": self.config.temperature,
        });

        if let Some(tool_defs) = tools {
            if !tool_defs.is_empty() {
                body["tools"] = json!(tool_defs);
                body["tool_choice"] = json!("auto");
            }
        }

        let mut request = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .bearer_token(&self.config.api_key);

        // Provider-specific headers.
        match self.config.provider {
            AiProvider::Claude => {
                // Anthropic uses x-api-key instead of Bearer token
                request = self
                    .client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .header("x-api-key", &self.config.api_key)
                    .header("anthropic-version", "2023-06-01");
            }
            AiProvider::Openrouter => {
                request = request
                    .header("HTTP-Referer", "https://newton-companion.app")
                    .header("X-Title", "Newton Companion");
            }
            _ => {}
        }

        let response = request
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ai(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response body".to_string());
            return Err(AppError::ai(format!(
                "AI API returned status {}: {}",
                status, body_text
            )));
        }

        let completion: ChatCompletionResponse = response
            .json()
            .await
            .map_err(|e| AppError::ai(format!("Failed to parse AI response: {}", e)))?;

        Ok(completion)
    }

    /// High-level chat with tool-use loop.
    /// Sends the user message, and if the model requests tool calls, executes them
    /// through the provided callback and loops until a text response is produced.
    pub async fn chat_with_tools<F, Fut>(
        &self,
        mut messages: Vec<ChatMessage>,
        tools: &[Value],
        mut execute_tool: F,
    ) -> Result<(String, Vec<ChatMessage>), AppError>
    where
        F: FnMut(String, String) -> Fut,
        Fut: std::future::Future<Output = Result<String, AppError>>,
    {
        let max_iterations = 10;
        let tool_slice = if tools.is_empty() { None } else { Some(tools) };

        for _ in 0..max_iterations {
            let completion = self.chat_completion(&messages, tool_slice).await?;

            let choice = completion
                .choices
                .into_iter()
                .next()
                .ok_or_else(|| AppError::ai("No choices in AI response"))?;

            let assistant_msg = choice.message;
            messages.push(assistant_msg.clone());

            // If the model wants to call tools, execute them and feed results back.
            if let Some(ref tool_calls) = assistant_msg.tool_calls {
                if !tool_calls.is_empty() {
                    for tc in tool_calls {
                        let result =
                            execute_tool(tc.function.name.clone(), tc.function.arguments.clone())
                                .await;

                        let tool_result = match result {
                            Ok(text) => text,
                            Err(e) => format!("Error executing tool: {}", e),
                        };

                        messages.push(ChatMessage {
                            role: "tool".to_string(),
                            content: Some(tool_result),
                            tool_calls: None,
                            tool_call_id: Some(tc.id.clone()),
                        });
                    }
                    continue; // Loop back for the next completion.
                }
            }

            // We got a text response -- return it.
            let text = assistant_msg
                .content
                .unwrap_or_default();
            return Ok((text, messages));
        }

        Err(AppError::ai("Tool-use loop exceeded maximum iterations"))
    }
}

/// Extension trait so we can call `.bearer_token()` on reqwest::RequestBuilder.
trait BearerTokenExt {
    fn bearer_token(self, token: &str) -> Self;
}

impl BearerTokenExt for reqwest::RequestBuilder {
    fn bearer_token(self, token: &str) -> Self {
        self.header("Authorization", format!("Bearer {}", token))
    }
}
