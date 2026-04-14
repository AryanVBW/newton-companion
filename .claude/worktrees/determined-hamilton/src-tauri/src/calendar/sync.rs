use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::calendar::google::{
    GoogleCalendarClient, COLOR_ASSIGNMENT, COLOR_ASSESSMENT, COLOR_CONTEST, COLOR_LECTURE,
};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncableEvent {
    pub newton_event_id: String,
    pub summary: String,
    pub description: String,
    pub start: String,
    pub end: String,
    pub color_id: String,
    pub event_type: String,
}

/// Parse Newton events into SyncableEvents.
pub fn prepare_events(events: &[Value], course_name: &str) -> Vec<SyncableEvent> {
    let mut result = Vec::new();

    for event in events {
        let event_id = event["id"]
            .as_str()
            .or_else(|| event["lecture_hash"].as_str())
            .or_else(|| event["assignment_hash"].as_str())
            .unwrap_or_default()
            .to_string();

        if event_id.is_empty() {
            continue;
        }

        let event_type = detect_event_type(event);
        let color_id = match event_type.as_str() {
            "lecture" => COLOR_LECTURE,
            "contest" => COLOR_CONTEST,
            "assignment" => COLOR_ASSIGNMENT,
            "assessment" => COLOR_ASSESSMENT,
            _ => COLOR_LECTURE,
        }
        .to_string();

        let summary = format!(
            "[{}] {}",
            course_name,
            event["title"]
                .as_str()
                .or_else(|| event["lecture_title"].as_str())
                .or_else(|| event["question_title"].as_str())
                .unwrap_or("Event")
        );

        let description = build_description(event, &event_type);

        let start = event["start_time"]
            .as_str()
            .or_else(|| event["start_datetime"].as_str())
            .or_else(|| event["due_date"].as_str())
            .unwrap_or_default()
            .to_string();

        let end = event["end_time"]
            .as_str()
            .or_else(|| event["end_datetime"].as_str())
            .or_else(|| event["due_date"].as_str())
            .unwrap_or(&start)
            .to_string();

        if start.is_empty() {
            continue;
        }

        result.push(SyncableEvent {
            newton_event_id: event_id,
            summary,
            description,
            start,
            end,
            color_id,
            event_type,
        });
    }

    result
}

/// Sync prepared events to Google Calendar (no DB access here).
pub async fn sync_prepared_events(
    gcal: &GoogleCalendarClient,
    events: &[SyncableEvent],
    email_reminder_minutes: Option<i32>,
) -> Vec<(String, String, String)> {
    // Returns Vec<(newton_event_id, google_event_id, event_type)> for successfully synced events.
    let mut results = Vec::new();

    for event in events {
        match gcal
            .create_event(
                &event.summary,
                &event.description,
                &event.start,
                &event.end,
                &event.color_id,
                email_reminder_minutes,
            )
            .await
        {
            Ok(gcal_event) => {
                let gcal_id = gcal_event["id"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string();
                results.push((
                    event.newton_event_id.clone(),
                    gcal_id,
                    event.event_type.clone(),
                ));
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to sync event {} to Google Calendar: {}",
                    event.newton_event_id,
                    e
                );
            }
        }
    }

    results
}

fn detect_event_type(event: &Value) -> String {
    if event
        .get("is_contest")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        "contest".to_string()
    } else if event.get("lecture_hash").is_some() || event.get("lecture_title").is_some() {
        "lecture".to_string()
    } else if event.get("assignment_hash").is_some() || event.get("due_date").is_some() {
        "assignment".to_string()
    } else if event.get("assessment_type").is_some() {
        "assessment".to_string()
    } else {
        "lecture".to_string()
    }
}

fn build_description(event: &Value, event_type: &str) -> String {
    let mut desc = String::new();
    match event_type {
        "lecture" => {
            if let Some(instructor) = event["instructor_user"]["name"].as_str() {
                desc.push_str(&format!("Instructor: {}\n", instructor));
            }
            if let Some(subject) = event["subject_name"].as_str() {
                desc.push_str(&format!("Subject: {}\n", subject));
            }
        }
        "assignment" => {
            if let Some(subject) = event["subject_name"].as_str() {
                desc.push_str(&format!("Subject: {}\n", subject));
            }
        }
        _ => {}
    }
    desc.push_str("\nSynced from Newton Companion");
    desc
}
