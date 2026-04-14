use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("MCP error: {0}")]
    Mcp(String),

    #[error("AI error: {0}")]
    Ai(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Server not found: {0}")]
    ServerNotFound(String),

    #[error("Server not running: {0}")]
    ServerNotRunning(String),

    #[error("Transport error: {0}")]
    Transport(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("{0}")]
    General(String),
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

impl AppError {
    pub fn mcp(msg: impl Into<String>) -> Self {
        AppError::Mcp(msg.into())
    }

    pub fn ai(msg: impl Into<String>) -> Self {
        AppError::Ai(msg.into())
    }

    pub fn config(msg: impl Into<String>) -> Self {
        AppError::Config(msg.into())
    }

    pub fn transport(msg: impl Into<String>) -> Self {
        AppError::Transport(msg.into())
    }

    pub fn general(msg: impl Into<String>) -> Self {
        AppError::General(msg.into())
    }
}
