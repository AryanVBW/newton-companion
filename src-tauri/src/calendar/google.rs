use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::AppError;

/// Color IDs for Google Calendar events.
pub const COLOR_LECTURE: &str = "9";    // blueberry
pub const COLOR_CONTEST: &str = "11";   // tomato
pub const COLOR_ASSIGNMENT: &str = "6"; // tangerine
pub const COLOR_ASSESSMENT: &str = "3"; // grape

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

pub struct GoogleCalendarClient {
    client: Client,
    tokens: Option<GoogleTokens>,
    auth_config: Option<GoogleAuthConfig>,
}

impl GoogleCalendarClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            tokens: None,
            auth_config: None,
        }
    }

    pub fn configure(&mut self, config: GoogleAuthConfig, tokens: Option<GoogleTokens>) {
        self.auth_config = Some(config);
        self.tokens = tokens;
    }

    pub fn is_connected(&self) -> bool {
        self.tokens.is_some() && self.auth_config.is_some()
    }

    /// Build the OAuth2 authorization URL for Google Calendar access.
    pub fn get_auth_url(&self) -> Result<String, AppError> {
        let config = self.auth_config.as_ref().ok_or_else(|| {
            AppError::Config("Google client_id not configured".into())
        })?;

        let redirect_uri = "http://localhost:17248/callback";
        let scope = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

        let url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
            urlencoding(&config.client_id),
            urlencoding(redirect_uri),
            urlencoding(scope),
        );
        Ok(url)
    }

    /// Exchange an authorization code for tokens.
    pub async fn exchange_code(
        &mut self,
        code: &str,
    ) -> Result<GoogleTokens, AppError> {
        let config = self.auth_config.as_ref().ok_or_else(|| {
            AppError::Config("Google client_id not configured".into())
        })?;

        let resp = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code),
                ("client_id", &config.client_id),
                ("client_secret", &config.client_secret),
                ("redirect_uri", "http://localhost:17248/callback"),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| AppError::Http(e))?;

        let body: Value = resp.json().await.map_err(|e| AppError::Http(e))?;

        let access_token = body["access_token"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let refresh_token = body["refresh_token"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let expires_in = body["expires_in"].as_i64().unwrap_or(3600);

        let expires_at = chrono::Utc::now()
            + chrono::Duration::seconds(expires_in);

        let tokens = GoogleTokens {
            access_token,
            refresh_token,
            expires_at: expires_at.to_rfc3339(),
        };

        self.tokens = Some(tokens.clone());
        Ok(tokens)
    }

    /// Refresh the access token using the refresh token.
    pub async fn refresh_access_token(&mut self) -> Result<(), AppError> {
        let config = self.auth_config.as_ref().ok_or_else(|| {
            AppError::Config("Google client_id not configured".into())
        })?;
        let tokens = self.tokens.as_ref().ok_or_else(|| {
            AppError::Config("No Google tokens available".into())
        })?;

        let resp = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("refresh_token", tokens.refresh_token.as_str()),
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| AppError::Http(e))?;

        let body: Value = resp.json().await.map_err(|e| AppError::Http(e))?;

        let new_access = body["access_token"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
        let expires_at = chrono::Utc::now()
            + chrono::Duration::seconds(expires_in);

        if let Some(ref mut t) = self.tokens {
            t.access_token = new_access;
            t.expires_at = expires_at.to_rfc3339();
        }

        Ok(())
    }

    fn access_token(&self) -> Result<&str, AppError> {
        self.tokens
            .as_ref()
            .map(|t| t.access_token.as_str())
            .ok_or_else(|| AppError::Config("Not authenticated with Google".into()))
    }

    /// Create a Google Calendar event.
    pub async fn create_event(
        &self,
        summary: &str,
        description: &str,
        start_datetime: &str,
        end_datetime: &str,
        color_id: &str,
        email_reminder_minutes: Option<i32>,
    ) -> Result<Value, AppError> {
        let token = self.access_token()?;

        let mut reminders = json!({
            "useDefault": false,
            "overrides": [
                {"method": "popup", "minutes": 10}
            ]
        });

        if let Some(mins) = email_reminder_minutes {
            reminders["overrides"]
                .as_array_mut()
                .unwrap()
                .push(json!({"method": "email", "minutes": mins}));
        }

        let event = json!({
            "summary": summary,
            "description": description,
            "start": {
                "dateTime": start_datetime,
                "timeZone": "Asia/Kolkata"
            },
            "end": {
                "dateTime": end_datetime,
                "timeZone": "Asia/Kolkata"
            },
            "colorId": color_id,
            "reminders": reminders
        });

        let resp = self
            .client
            .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
            .bearer_auth(token)
            .json(&event)
            .send()
            .await
            .map_err(|e| AppError::Http(e))?;

        let body: Value = resp.json().await.map_err(|e| AppError::Http(e))?;
        Ok(body)
    }

    /// Delete a Google Calendar event.
    pub async fn delete_event(&self, event_id: &str) -> Result<(), AppError> {
        let token = self.access_token()?;
        self.client
            .delete(format!(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
                event_id
            ))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::Http(e))?;
        Ok(())
    }

    /// List events in a time range.
    pub async fn list_events(
        &self,
        time_min: &str,
        time_max: &str,
    ) -> Result<Value, AppError> {
        let token = self.access_token()?;
        let resp = self
            .client
            .get("https://www.googleapis.com/calendar/v3/calendars/primary/events")
            .bearer_auth(token)
            .query(&[
                ("timeMin", time_min),
                ("timeMax", time_max),
                ("singleEvents", "true"),
                ("orderBy", "startTime"),
                ("maxResults", "250"),
            ])
            .send()
            .await
            .map_err(|e| AppError::Http(e))?;

        let body: Value = resp.json().await.map_err(|e| AppError::Http(e))?;
        Ok(body)
    }
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20")
        .replace(':', "%3A")
        .replace('/', "%2F")
        .replace('@', "%40")
        .replace('&', "%26")
        .replace('=', "%3D")
        .replace('+', "%2B")
}
