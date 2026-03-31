use chrono::Utc;
use rusqlite::Connection;
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::ai::types::{MemoryCategory, MemoryEntry};
use crate::error::AppError;

// ---------------------------------------------------------------------------
// MemoryManager — short-term (in-memory) + long-term (SQLite) memory
// ---------------------------------------------------------------------------

pub struct MemoryManager {
    /// Hot cache: short-term memory for the current session
    short_term: HashMap<String, MemoryEntry>,
    /// Max entries in short-term before compression triggers
    short_term_limit: usize,
}

impl MemoryManager {
    pub fn new() -> Self {
        Self {
            short_term: HashMap::new(),
            short_term_limit: 100,
        }
    }

    // -----------------------------------------------------------------------
    // Short-term memory (in-memory, current session)
    // -----------------------------------------------------------------------

    /// Store a short-term memory entry.
    pub fn remember_short(&mut self, content: String, tags: Vec<String>) -> String {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let entry = MemoryEntry {
            id: id.clone(),
            category: MemoryCategory::ShortTerm,
            content,
            context_tags: tags,
            importance: 0.5,
            created_at: now,
            last_accessed: now,
            access_count: 0,
            ttl_seconds: Some(3600), // 1 hour default
        };
        self.short_term.insert(id.clone(), entry);

        // Auto-compress if over limit
        if self.short_term.len() > self.short_term_limit {
            self.compress_short_term();
        }

        id
    }

    /// Retrieve short-term memories matching any of the given tags.
    pub fn recall_short(&mut self, tags: &[String], limit: usize) -> Vec<&MemoryEntry> {
        let now = Utc::now();
        let mut results: Vec<&mut MemoryEntry> = self
            .short_term
            .values_mut()
            .filter(|e| {
                // Check TTL
                if let Some(ttl) = e.ttl_seconds {
                    let age = (now - e.created_at).num_seconds();
                    if age > ttl {
                        return false;
                    }
                }
                // Match tags
                if tags.is_empty() {
                    return true;
                }
                e.context_tags.iter().any(|t| tags.contains(t))
            })
            .collect();

        // Sort by importance (descending), then by recency
        results.sort_by(|a, b| {
            b.importance
                .partial_cmp(&a.importance)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.last_accessed.cmp(&a.last_accessed))
        });

        // Update access counts
        for entry in &mut results {
            entry.access_count += 1;
            entry.last_accessed = now;
        }

        results
            .into_iter()
            .take(limit)
            .map(|e| &*e)
            .collect()
    }

    /// Get all short-term memories (for context building).
    pub fn get_short_term_context(&self) -> Vec<&MemoryEntry> {
        let mut entries: Vec<&MemoryEntry> = self.short_term.values().collect();
        entries.sort_by(|a, b| b.importance.partial_cmp(&a.importance).unwrap_or(std::cmp::Ordering::Equal));
        entries
    }

    /// Remove expired short-term entries and low-importance ones when over limit.
    fn compress_short_term(&mut self) {
        let now = Utc::now();

        // Remove expired
        self.short_term.retain(|_, e| {
            if let Some(ttl) = e.ttl_seconds {
                let age = (now - e.created_at).num_seconds();
                age <= ttl
            } else {
                true
            }
        });

        // If still over limit, remove lowest importance entries
        if self.short_term.len() > self.short_term_limit {
            let mut entries: Vec<(String, f64)> = self
                .short_term
                .iter()
                .map(|(id, e)| (id.clone(), e.importance))
                .collect();
            entries.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

            let to_remove = self.short_term.len() - self.short_term_limit;
            for (id, _) in entries.into_iter().take(to_remove) {
                self.short_term.remove(&id);
            }
        }
    }

    /// Clear all short-term memory (e.g., when a goal completes).
    pub fn clear_short_term(&mut self) {
        self.short_term.clear();
    }

    // -----------------------------------------------------------------------
    // Long-term memory (SQLite-backed, persists across sessions)
    // -----------------------------------------------------------------------

    /// Store a long-term memory entry in the database.
    pub fn remember_long(
        &self,
        db: &Arc<std::sync::Mutex<Connection>>,
        content: String,
        category: MemoryCategory,
        tags: Vec<String>,
        importance: f64,
    ) -> Result<String, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
        let category_str = serde_json::to_string(&category).unwrap_or_else(|_| "\"short_term\"".to_string());

        let conn = db.lock().map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;
        conn.execute(
            "INSERT INTO brain_memory (id, category, content, context_tags, importance, created_at, last_accessed, access_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
            rusqlite::params![id, category_str, content, tags_json, importance, now, now],
        )?;

        Ok(id)
    }

    /// Recall long-term memories by category and/or tags.
    pub fn recall_long(
        &self,
        db: &Arc<std::sync::Mutex<Connection>>,
        category: Option<MemoryCategory>,
        tags: &[String],
        limit: usize,
    ) -> Result<Vec<MemoryEntry>, AppError> {
        let conn = db.lock().map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;

        let mut query = String::from(
            "SELECT id, category, content, context_tags, importance, created_at, last_accessed, access_count
             FROM brain_memory WHERE 1=1"
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref cat) = category {
            let cat_str = serde_json::to_string(cat).unwrap_or_default();
            query.push_str(" AND category = ?");
            params.push(Box::new(cat_str));
        }

        query.push_str(" ORDER BY importance DESC, last_accessed DESC LIMIT ?");
        params.push(Box::new(limit as i64));

        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let tags_str: String = row.get(3)?;
            let cat_str: String = row.get(1)?;
            let created_str: String = row.get(5)?;
            let accessed_str: String = row.get(6)?;

            Ok(MemoryEntry {
                id: row.get(0)?,
                category: serde_json::from_str(&cat_str).unwrap_or(MemoryCategory::ShortTerm),
                content: row.get(2)?,
                context_tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                importance: row.get(4)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&created_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                last_accessed: chrono::DateTime::parse_from_rfc3339(&accessed_str)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                access_count: row.get(7)?,
                ttl_seconds: None,
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            if let Ok(entry) = row {
                // Filter by tags if provided
                if !tags.is_empty() {
                    if entry.context_tags.iter().any(|t| tags.contains(t)) {
                        entries.push(entry);
                    }
                } else {
                    entries.push(entry);
                }
            }
        }

        // Update access timestamps
        let now = Utc::now().to_rfc3339();
        for entry in &entries {
            let _ = conn.execute(
                "UPDATE brain_memory SET last_accessed = ?1, access_count = access_count + 1 WHERE id = ?2",
                rusqlite::params![now, entry.id],
            );
        }

        Ok(entries)
    }

    /// Build a context string from relevant memories for the current task.
    pub fn build_context(
        &mut self,
        db: &Arc<std::sync::Mutex<Connection>>,
        tags: &[String],
    ) -> String {
        let mut context_parts: Vec<String> = Vec::new();

        // Short-term context
        let short_term = self.recall_short(tags, 10);
        if !short_term.is_empty() {
            context_parts.push("## Current Session Context".to_string());
            for entry in short_term {
                context_parts.push(format!("- {}", entry.content));
            }
        }

        // Long-term context
        if let Ok(long_term) = self.recall_long(db, None, tags, 10) {
            if !long_term.is_empty() {
                context_parts.push("\n## Learned Knowledge".to_string());
                for entry in long_term {
                    let cat_label = match entry.category {
                        MemoryCategory::LearnedPattern => "Pattern",
                        MemoryCategory::ProjectKnowledge => "Project",
                        MemoryCategory::ToolPattern => "Tool",
                        MemoryCategory::ErrorSolution => "Fix",
                        MemoryCategory::UserPreference => "Preference",
                        _ => "Note",
                    };
                    context_parts.push(format!("- [{}] {}", cat_label, entry.content));
                }
            }
        }

        context_parts.join("\n")
    }

    /// Forget a specific memory entry.
    pub fn forget(
        &mut self,
        db: &Arc<std::sync::Mutex<Connection>>,
        memory_id: &str,
    ) -> Result<(), AppError> {
        // Try short-term first
        if self.short_term.remove(memory_id).is_some() {
            return Ok(());
        }

        // Try long-term
        let conn = db.lock().map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;
        conn.execute("DELETE FROM brain_memory WHERE id = ?1", rusqlite::params![memory_id])?;
        Ok(())
    }

    /// Decay old, low-access memories from long-term storage.
    pub fn decay_memories(
        &self,
        db: &Arc<std::sync::Mutex<Connection>>,
        max_age_days: i64,
        min_access_count: u32,
    ) -> Result<u32, AppError> {
        let conn = db.lock().map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;
        let cutoff = (Utc::now() - chrono::Duration::days(max_age_days)).to_rfc3339();

        let deleted = conn.execute(
            "DELETE FROM brain_memory WHERE last_accessed < ?1 AND access_count < ?2 AND category != ?3",
            rusqlite::params![cutoff, min_access_count, "\"user_preference\""],
        )?;

        Ok(deleted as u32)
    }

    /// Count total long-term memories.
    pub fn count_long_term(
        &self,
        db: &Arc<std::sync::Mutex<Connection>>,
    ) -> Result<u32, AppError> {
        let conn = db.lock().map_err(|e| AppError::general(format!("DB lock error: {}", e)))?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM brain_memory", [], |row| row.get(0))?;
        Ok(count as u32)
    }
}
