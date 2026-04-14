use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::calendar::google::GoogleCalendarClient;
use crate::error::AppError;
use crate::mcp::protocol::McpTool;

/// Built-in tools that the AI brain can call directly (not through MCP servers).
/// These wrap internal app capabilities (Google Calendar, etc.) as if they were
/// MCP tools, so the brain's tool-use loop handles them uniformly.

/// Returns tool definitions for all built-in tools in MCP-compatible format.
pub fn builtin_tool_definitions(calendar_connected: bool) -> Vec<McpTool> {
    let mut tools = Vec::new();

    if calendar_connected {
        tools.push(McpTool {
            name: "calendar_create_event".to_string(),
            description: Some(
                "Create a new Google Calendar event. Use this to schedule study sessions, \
                 lectures, assignments, meetings, or any timed event. Returns the created \
                 event details including its ID."
                    .to_string(),
            ),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Event title/name"
                    },
                    "description": {
                        "type": "string",
                        "description": "Event description or notes"
                    },
                    "start_datetime": {
                        "type": "string",
                        "description": "Start time in ISO 8601 format (e.g. 2026-04-02T14:00:00+05:30)"
                    },
                    "end_datetime": {
                        "type": "string",
                        "description": "End time in ISO 8601 format (e.g. 2026-04-02T15:00:00+05:30)"
                    },
                    "color": {
                        "type": "string",
                        "enum": ["lecture", "contest", "assignment", "assessment", "default"],
                        "description": "Color category: lecture (blue), contest (red), assignment (orange), assessment (purple), default"
                    },
                    "reminder_minutes": {
                        "type": "integer",
                        "description": "Email reminder minutes before event (optional)"
                    }
                },
                "required": ["summary", "start_datetime", "end_datetime"]
            }),
        });

        tools.push(McpTool {
            name: "calendar_list_events".to_string(),
            description: Some(
                "List Google Calendar events within a time range. Use this to check the \
                 user's schedule, find free time, or see upcoming events. Returns events \
                 sorted by start time."
                    .to_string(),
            ),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "time_min": {
                        "type": "string",
                        "description": "Start of time range in ISO 8601 format (e.g. 2026-04-01T00:00:00+05:30)"
                    },
                    "time_max": {
                        "type": "string",
                        "description": "End of time range in ISO 8601 format (e.g. 2026-04-07T23:59:59+05:30)"
                    }
                },
                "required": ["time_min", "time_max"]
            }),
        });

        tools.push(McpTool {
            name: "calendar_delete_event".to_string(),
            description: Some(
                "Delete a Google Calendar event by its ID. Use this to remove cancelled \
                 or rescheduled events."
                    .to_string(),
            ),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "string",
                        "description": "The Google Calendar event ID to delete"
                    }
                },
                "required": ["event_id"]
            }),
        });
    }

    // Always available: a tool to check which integrations are active
    tools.push(McpTool {
        name: "check_integrations".to_string(),
        description: Some(
            "Check which integrations are currently connected (Google Calendar, Notion, etc.). \
             Returns the status of each integration."
                .to_string(),
        ),
        input_schema: json!({
            "type": "object",
            "properties": {},
            "required": []
        }),
    });

    tools
}

/// Execute a built-in tool call. Returns Ok(result_text) or Err.
pub async fn execute_builtin_tool(
    tool_name: &str,
    arguments: Value,
    google_calendar: &Arc<Mutex<GoogleCalendarClient>>,
    notion_connected: bool,
) -> Result<String, AppError> {
    match tool_name {
        "calendar_create_event" => {
            let summary = arguments["summary"]
                .as_str()
                .unwrap_or("Untitled Event");
            let description = arguments["description"]
                .as_str()
                .unwrap_or("");
            let start = arguments["start_datetime"]
                .as_str()
                .ok_or_else(|| AppError::ai("Missing start_datetime"))?;
            let end = arguments["end_datetime"]
                .as_str()
                .ok_or_else(|| AppError::ai("Missing end_datetime"))?;

            let color_id = match arguments["color"].as_str().unwrap_or("default") {
                "lecture" => crate::calendar::google::COLOR_LECTURE,
                "contest" => crate::calendar::google::COLOR_CONTEST,
                "assignment" => crate::calendar::google::COLOR_ASSIGNMENT,
                "assessment" => crate::calendar::google::COLOR_ASSESSMENT,
                _ => "0", // default
            };

            let reminder = arguments["reminder_minutes"].as_i64().map(|m| m as i32);

            let gcal = google_calendar.lock().await;
            let result = gcal
                .create_event(summary, description, start, end, color_id, reminder)
                .await?;

            let event_id = result["id"].as_str().unwrap_or("unknown");
            let link = result["htmlLink"].as_str().unwrap_or("");

            Ok(format!(
                "Event created successfully!\n- Title: {}\n- Start: {}\n- End: {}\n- Event ID: {}\n- Link: {}",
                summary, start, end, event_id, link
            ))
        }

        "calendar_list_events" => {
            let time_min = arguments["time_min"]
                .as_str()
                .ok_or_else(|| AppError::ai("Missing time_min"))?;
            let time_max = arguments["time_max"]
                .as_str()
                .ok_or_else(|| AppError::ai("Missing time_max"))?;

            let gcal = google_calendar.lock().await;
            let result = gcal.list_events(time_min, time_max).await?;

            let items = result["items"].as_array();
            match items {
                Some(events) if !events.is_empty() => {
                    let mut output = format!("Found {} events:\n\n", events.len());
                    for (i, event) in events.iter().enumerate() {
                        let summary = event["summary"].as_str().unwrap_or("(No title)");
                        let start = event["start"]["dateTime"]
                            .as_str()
                            .or_else(|| event["start"]["date"].as_str())
                            .unwrap_or("unknown");
                        let end = event["end"]["dateTime"]
                            .as_str()
                            .or_else(|| event["end"]["date"].as_str())
                            .unwrap_or("unknown");
                        let event_id = event["id"].as_str().unwrap_or("");
                        let status = event["status"].as_str().unwrap_or("confirmed");

                        output.push_str(&format!(
                            "{}. **{}**\n   Start: {}\n   End: {}\n   Status: {}\n   ID: {}\n\n",
                            i + 1,
                            summary,
                            start,
                            end,
                            status,
                            event_id
                        ));
                    }
                    Ok(output)
                }
                _ => Ok("No events found in the specified time range.".to_string()),
            }
        }

        "calendar_delete_event" => {
            let event_id = arguments["event_id"]
                .as_str()
                .ok_or_else(|| AppError::ai("Missing event_id"))?;

            let gcal = google_calendar.lock().await;
            gcal.delete_event(event_id).await?;

            Ok(format!("Event '{}' deleted successfully.", event_id))
        }

        "check_integrations" => {
            let gcal = google_calendar.lock().await;
            let calendar_status = if gcal.is_connected() {
                "Connected"
            } else {
                "Not connected"
            };

            let notion_status = if notion_connected {
                "Connected (via MCP)"
            } else {
                "Not connected"
            };

            Ok(format!(
                "Integration Status:\n\
                 - Google Calendar: {}\n\
                 - Notion: {}\n\
                 \n\
                 To connect integrations, go to the Integrations page in the sidebar.",
                calendar_status, notion_status,
            ))
        }

        _ => Err(AppError::ai(format!("Unknown built-in tool: {}", tool_name))),
    }
}

/// Check if a tool name is a built-in tool.
pub fn is_builtin_tool(tool_name: &str) -> bool {
    matches!(
        tool_name,
        "calendar_create_event"
            | "calendar_list_events"
            | "calendar_delete_event"
            | "check_integrations"
    )
}
