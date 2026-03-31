use std::collections::HashMap;
use std::time::Instant;

use crate::ai::brain::{AiBrain, ChatMessage, ChatCompletionResponse};
use crate::ai::providers::AiConfig;
use crate::ai::types::{LlmRequest, LlmResponse, TaskType};
use crate::error::AppError;

// ---------------------------------------------------------------------------
// Provider Health — tracks availability and rate-limit state per provider
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ProviderHealth {
    pub name: String,
    pub total_requests: u64,
    pub failed_requests: u64,
    pub total_tokens: u64,
    pub last_error: Option<String>,
    pub last_error_at: Option<Instant>,
    pub consecutive_failures: u32,
    /// Cooldown: if too many failures, wait before retrying
    pub cooldown_until: Option<Instant>,
}

impl ProviderHealth {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            total_requests: 0,
            failed_requests: 0,
            total_tokens: 0,
            last_error: None,
            last_error_at: None,
            consecutive_failures: 0,
            cooldown_until: None,
        }
    }

    fn record_success(&mut self, tokens: u32) {
        self.total_requests += 1;
        self.total_tokens += tokens as u64;
        self.consecutive_failures = 0;
    }

    fn record_failure(&mut self, error: &str) {
        self.total_requests += 1;
        self.failed_requests += 1;
        self.last_error = Some(error.to_string());
        self.last_error_at = Some(Instant::now());
        self.consecutive_failures += 1;

        // After 3 consecutive failures, cool down for 60 seconds
        if self.consecutive_failures >= 3 {
            self.cooldown_until = Some(Instant::now() + std::time::Duration::from_secs(60));
        }
    }

    fn is_available(&self) -> bool {
        match self.cooldown_until {
            Some(until) => Instant::now() > until,
            None => true,
        }
    }
}

// ---------------------------------------------------------------------------
// Coordinator — Multi-LLM routing with fallback and health tracking
// ---------------------------------------------------------------------------

pub struct Coordinator {
    /// All registered provider configs, keyed by a label (e.g. "primary", "fast", "reasoning")
    providers: HashMap<String, AiConfig>,
    /// Health stats per provider label
    health: HashMap<String, ProviderHealth>,
    /// Task-type → ordered list of provider labels to try
    routing_table: HashMap<TaskType, Vec<String>>,
}

impl Coordinator {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            health: HashMap::new(),
            routing_table: Self::default_routing_table(),
        }
    }

    /// Initialise with a single provider (most common case — user has one API key).
    pub fn with_primary(config: AiConfig) -> Self {
        let mut coord = Self::new();
        coord.add_provider("primary", config);
        coord
    }

    /// Register a provider under a label.
    pub fn add_provider(&mut self, label: &str, config: AiConfig) {
        self.providers.insert(label.to_string(), config);
        self.health
            .entry(label.to_string())
            .or_insert_with(|| ProviderHealth::new(label));

        // If this is the only provider, make it the fallback for everything
        if self.providers.len() == 1 {
            for priorities in self.routing_table.values_mut() {
                if !priorities.contains(&label.to_string()) {
                    priorities.push(label.to_string());
                }
            }
        }
    }

    /// Update the primary provider config (called from settings).
    pub fn update_primary(&mut self, config: AiConfig) {
        self.providers.insert("primary".to_string(), config);
        if !self.health.contains_key("primary") {
            self.health
                .insert("primary".to_string(), ProviderHealth::new("primary"));
        }
    }

    /// Get a read-only view of the primary config.
    pub fn get_primary_config(&self) -> Option<&AiConfig> {
        self.providers.get("primary")
    }

    /// Get health stats for all providers.
    pub fn get_health(&self) -> &HashMap<String, ProviderHealth> {
        &self.health
    }

    /// Get list of configured provider labels.
    pub fn configured_providers(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }

    // -----------------------------------------------------------------------
    // Routing
    // -----------------------------------------------------------------------

    /// Route and execute an LLM request with automatic fallback.
    pub async fn route_request(&mut self, request: &LlmRequest) -> Result<LlmResponse, AppError> {
        // If a specific provider is forced, use it directly
        if let Some(ref forced) = request.force_provider {
            return self.send_to_provider(forced, request).await;
        }

        // Get the priority list for this task type
        let priorities = self
            .routing_table
            .get(&request.task_type)
            .cloned()
            .unwrap_or_else(|| vec!["primary".to_string()]);

        let mut last_error = String::from("No providers available");

        for label in &priorities {
            // Skip unavailable providers
            if let Some(health) = self.health.get(label) {
                if !health.is_available() {
                    tracing::debug!("Skipping cooled-down provider '{}'", label);
                    continue;
                }
            }

            // Skip unconfigured providers
            if !self.providers.contains_key(label) {
                continue;
            }

            match self.send_to_provider(label, request).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    last_error = e.to_string();
                    tracing::warn!(
                        "Provider '{}' failed for {:?} task: {}",
                        label,
                        request.task_type,
                        last_error
                    );
                    // record_failure is already called inside send_to_provider
                    continue;
                }
            }
        }

        Err(AppError::ai(format!(
            "All providers failed. Last error: {}",
            last_error
        )))
    }

    /// Send a request to a specific provider.
    async fn send_to_provider(
        &mut self,
        label: &str,
        request: &LlmRequest,
    ) -> Result<LlmResponse, AppError> {
        let config = self
            .providers
            .get(label)
            .ok_or_else(|| AppError::ai(format!("Provider '{}' not configured", label)))?
            .clone();

        if config.api_key.is_empty() {
            return Err(AppError::ai(format!(
                "Provider '{}' has no API key configured",
                label
            )));
        }

        // Build a temporary AiBrain with this provider's config
        let mut client = AiBrain::new();
        let mut cfg = config.clone();

        // Apply request-level overrides
        if let Some(temp) = request.temperature {
            cfg.temperature = temp;
        }
        client.configure(cfg);

        // Convert LlmRequest messages to ChatMessages
        let messages: Vec<ChatMessage> = request
            .messages
            .iter()
            .map(|m| ChatMessage {
                role: m.role.clone(),
                content: Some(m.content.clone()),
                tool_calls: None,
                tool_call_id: None,
            })
            .collect();

        let tools = request.tools.as_deref();

        let result: Result<ChatCompletionResponse, AppError> =
            client.chat_completion(&messages, tools).await;

        match result {
            Ok(completion) => {
                let tokens = completion.usage.as_ref().map(|u| u.total_tokens).unwrap_or(0);
                if let Some(health) = self.health.get_mut(label) {
                    health.record_success(tokens);
                }

                let choice = completion
                    .choices
                    .first()
                    .ok_or_else(|| AppError::ai("No choices in response"))?;

                let tool_calls = choice.message.tool_calls.as_ref().map(|tcs| {
                    tcs.iter()
                        .map(|tc| {
                            serde_json::json!({
                                "id": tc.id,
                                "type": tc.call_type,
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                }
                            })
                        })
                        .collect()
                });

                Ok(LlmResponse {
                    content: choice.message.content.clone().unwrap_or_default(),
                    provider_used: config.provider.as_str().to_string(),
                    model_used: config.model_id.clone(),
                    tokens_used: Some(tokens),
                    tool_calls,
                })
            }
            Err(e) => {
                if let Some(health) = self.health.get_mut(label) {
                    health.record_failure(&e.to_string());
                }
                Err(e)
            }
        }
    }

    /// Simple chat convenience — sends messages through the primary provider.
    pub async fn chat(
        &mut self,
        messages: Vec<ChatMessage>,
        tools: &[serde_json::Value],
    ) -> Result<(String, Vec<ChatMessage>), AppError> {
        let config = self
            .providers
            .get("primary")
            .ok_or_else(|| AppError::ai("No primary provider configured"))?
            .clone();

        let mut client = AiBrain::new();
        client.configure(config);

        let tool_slice: &[serde_json::Value] = tools;
        let empty_closure = |tool_name: String, _arguments: String| async move {
            Err::<String, AppError>(AppError::ai(format!(
                "Tool '{}' not available in simple chat mode",
                tool_name
            )))
        };

        client.chat_with_tools(messages, tool_slice, empty_closure).await
    }

    // -----------------------------------------------------------------------
    // Default routing table
    // -----------------------------------------------------------------------

    fn default_routing_table() -> HashMap<TaskType, Vec<String>> {
        let mut table = HashMap::new();

        // For reasoning tasks, prefer strong models → fall back to primary
        table.insert(
            TaskType::Reasoning,
            vec!["reasoning".to_string(), "primary".to_string()],
        );

        // For coding, prefer code-optimized models
        table.insert(
            TaskType::Coding,
            vec!["coding".to_string(), "primary".to_string()],
        );

        // Simple tasks use fast/cheap models
        table.insert(
            TaskType::Simple,
            vec!["fast".to_string(), "primary".to_string()],
        );

        // Creative uses the primary model
        table.insert(
            TaskType::Creative,
            vec!["primary".to_string()],
        );

        // Tool use needs good function-calling support
        table.insert(
            TaskType::ToolUse,
            vec!["primary".to_string()],
        );

        table
    }
}
