use crate::ai::brain::AiBrain;
use crate::calendar::google::GoogleCalendarClient;
use crate::mcp::manager::McpManager;
use rusqlite::Connection;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub mcp_manager: Arc<Mutex<McpManager>>,
    pub db: Arc<std::sync::Mutex<Connection>>,
    pub ai_brain: Arc<Mutex<AiBrain>>,
    pub google_calendar: Arc<Mutex<GoogleCalendarClient>>,
    /// Holds the `newton-mcp login` child process while waiting for user to authorize.
    pub login_process: Arc<Mutex<Option<tokio::process::Child>>>,
}

impl AppState {
    pub fn new(db: Connection) -> Self {
        Self {
            mcp_manager: Arc::new(Mutex::new(McpManager::new())),
            db: Arc::new(std::sync::Mutex::new(db)),
            ai_brain: Arc::new(Mutex::new(AiBrain::new())),
            google_calendar: Arc::new(Mutex::new(GoogleCalendarClient::new())),
            login_process: Arc::new(Mutex::new(None)),
        }
    }
}
