use serde::{Deserialize, Serialize};

/// Supported AI provider identifiers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Github,
    GithubCopilot,
    Claude,
    Openrouter,
    Gemini,
    Custom,
}

impl AiProvider {
    /// Returns the default base URL for this provider.
    pub fn default_base_url(&self) -> &str {
        match self {
            AiProvider::Github => "https://models.inference.ai.azure.com",
            AiProvider::GithubCopilot => "https://api.githubcopilot.com",
            AiProvider::Claude => "https://api.anthropic.com/v1",
            AiProvider::Openrouter => "https://openrouter.ai/api",
            AiProvider::Gemini => {
                "https://generativelanguage.googleapis.com/v1beta/openai"
            }
            AiProvider::Custom => "",
        }
    }

    /// Returns a list of common model IDs for the provider.
    pub fn default_models(&self) -> Vec<ModelInfo> {
        match self {
            AiProvider::Github => vec![
                ModelInfo::new("gpt-4.1", "GPT-4.1"),
                ModelInfo::new("gpt-4o", "GPT-4o"),
                ModelInfo::new("gpt-4o-mini", "GPT-4o Mini"),
                ModelInfo::new("Meta-Llama-3.3-70B-Instruct", "Llama 3.3 70B"),
                ModelInfo::new("Mistral-Large-2501", "Mistral Large"),
            ],
            AiProvider::GithubCopilot => vec![
                ModelInfo::new("gpt-4.1", "GPT-4.1"),
                ModelInfo::new("gpt-4o", "GPT-4o"),
                ModelInfo::new("claude-sonnet-4", "Claude Sonnet 4"),
                ModelInfo::new("o4-mini", "o4-mini"),
                ModelInfo::new("gemini-2.5-flash", "Gemini 2.5 Flash"),
            ],
            AiProvider::Claude => vec![
                ModelInfo::new("claude-sonnet-4-20250514", "Claude Sonnet 4"),
                ModelInfo::new("claude-haiku-4-5-20251001", "Claude Haiku 4.5"),
                ModelInfo::new("claude-opus-4-20250514", "Claude Opus 4"),
            ],
            AiProvider::Openrouter => vec![
                ModelInfo::new("openai/gpt-4.1", "GPT-4.1"),
                ModelInfo::new("anthropic/claude-sonnet-4", "Claude Sonnet 4"),
                ModelInfo::new("google/gemini-2.5-flash-preview", "Gemini 2.5 Flash"),
                ModelInfo::new("meta-llama/llama-4-maverick", "Llama 4 Maverick"),
            ],
            AiProvider::Gemini => vec![
                ModelInfo::new("gemini-2.5-flash-preview-05-20", "Gemini 2.5 Flash"),
                ModelInfo::new("gemini-2.5-pro-preview-05-06", "Gemini 2.5 Pro"),
                ModelInfo::new("gemini-2.0-flash", "Gemini 2.0 Flash"),
            ],
            AiProvider::Custom => vec![],
        }
    }

    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "github" => AiProvider::Github,
            "github_copilot" | "copilot" | "githubcopilot" => AiProvider::GithubCopilot,
            "claude" | "anthropic" => AiProvider::Claude,
            "openrouter" => AiProvider::Openrouter,
            "gemini" | "google" => AiProvider::Gemini,
            _ => AiProvider::Custom,
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            AiProvider::Github => "github",
            AiProvider::GithubCopilot => "github_copilot",
            AiProvider::Claude => "claude",
            AiProvider::Openrouter => "openrouter",
            AiProvider::Gemini => "gemini",
            AiProvider::Custom => "custom",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
}

impl ModelInfo {
    pub fn new(id: &str, name: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
        }
    }
}

/// Full configuration for the AI client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub provider: AiProvider,
    pub base_url: String,
    pub api_key: String,
    pub model_id: String,
    pub temperature: f64,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: AiProvider::Github,
            base_url: AiProvider::Github.default_base_url().to_string(),
            api_key: String::new(),
            model_id: "gpt-4o".to_string(),
            temperature: 0.7,
        }
    }
}
