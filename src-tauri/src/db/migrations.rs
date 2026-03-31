use rusqlite::Connection;

/// Run all database migrations.
pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mcp_servers (
            id              TEXT PRIMARY KEY NOT NULL,
            name            TEXT NOT NULL,
            transport_type  TEXT NOT NULL DEFAULT 'stdio',
            command         TEXT NOT NULL,
            args_json       TEXT NOT NULL DEFAULT '[]',
            url             TEXT,
            env_json        TEXT NOT NULL DEFAULT '{}',
            enabled         INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS ai_config (
            id         INTEGER PRIMARY KEY CHECK (id = 1),
            provider   TEXT NOT NULL DEFAULT 'claude',
            base_url   TEXT NOT NULL DEFAULT 'https://api.anthropic.com/v1',
            api_key    TEXT NOT NULL DEFAULT '',
            model_id   TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
            temperature REAL NOT NULL DEFAULT 0.7
        );

        INSERT OR IGNORE INTO ai_config (id, provider, base_url, api_key, model_id, temperature)
        VALUES (1, 'claude', 'https://api.anthropic.com/v1', '', 'claude-haiku-4-5-20251001', 0.7);

        CREATE TABLE IF NOT EXISTS chat_history (
            id               TEXT PRIMARY KEY NOT NULL,
            role             TEXT NOT NULL,
            content          TEXT,
            tool_calls_json  TEXT,
            timestamp        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS onboarding_state (
            id        INTEGER PRIMARY KEY CHECK (id = 1),
            completed INTEGER NOT NULL DEFAULT 0
        );

        INSERT OR IGNORE INTO onboarding_state (id, completed) VALUES (1, 0);

        CREATE TABLE IF NOT EXISTS mcp_cache (
            cache_key     TEXT PRIMARY KEY NOT NULL,
            response_json TEXT NOT NULL,
            cached_at     TEXT NOT NULL DEFAULT (datetime('now')),
            ttl_seconds   INTEGER NOT NULL DEFAULT 300
        );

        CREATE TABLE IF NOT EXISTS google_auth (
            id            INTEGER PRIMARY KEY CHECK (id = 1),
            access_token  TEXT NOT NULL DEFAULT '',
            refresh_token TEXT NOT NULL DEFAULT '',
            expires_at    TEXT NOT NULL DEFAULT '',
            client_id     TEXT NOT NULL DEFAULT '',
            client_secret TEXT NOT NULL DEFAULT ''
        );
        INSERT OR IGNORE INTO google_auth (id) VALUES (1);

        CREATE TABLE IF NOT EXISTS google_calendar_sync (
            newton_event_id TEXT PRIMARY KEY NOT NULL,
            google_event_id TEXT NOT NULL,
            event_type      TEXT NOT NULL,
            course_name     TEXT,
            last_synced     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS selected_course (
            id            INTEGER PRIMARY KEY CHECK (id = 1),
            course_hash   TEXT NOT NULL DEFAULT '',
            course_name   TEXT NOT NULL DEFAULT '',
            semester_name TEXT
        );
        INSERT OR IGNORE INTO selected_course (id) VALUES (1);

        CREATE TABLE IF NOT EXISTS newton_auth (
            id            INTEGER PRIMARY KEY CHECK (id = 1),
            access_token  TEXT NOT NULL DEFAULT '',
            refresh_token TEXT NOT NULL DEFAULT '',
            user_name     TEXT NOT NULL DEFAULT '',
            user_email    TEXT NOT NULL DEFAULT '',
            linked_at     TEXT NOT NULL DEFAULT '',
            device_name   TEXT NOT NULL DEFAULT ''
        );
        INSERT OR IGNORE INTO newton_auth (id) VALUES (1);

        -- Local cache for all Newton MCP data.
        -- Each tool's response is stored as a row keyed by tool_name.
        -- On every app launch the data is refreshed from the MCP server.
        CREATE TABLE IF NOT EXISTS newton_data_cache (
            tool_name     TEXT PRIMARY KEY NOT NULL,
            args_json     TEXT NOT NULL DEFAULT '{}',
            response_json TEXT NOT NULL DEFAULT '{}',
            fetched_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Stores the list of tools discovered from newton-mcp
        CREATE TABLE IF NOT EXISTS newton_mcp_tools (
            name          TEXT PRIMARY KEY NOT NULL,
            description   TEXT NOT NULL DEFAULT '',
            input_schema  TEXT NOT NULL DEFAULT '{}'
        );

        -- ===================================================================
        -- AI Agent Brain tables
        -- ===================================================================

        -- Persistent memory for the brain (learned patterns, project knowledge, etc.)
        CREATE TABLE IF NOT EXISTS brain_memory (
            id             TEXT PRIMARY KEY NOT NULL,
            category       TEXT NOT NULL,
            content        TEXT NOT NULL,
            context_tags   TEXT NOT NULL DEFAULT '[]',
            importance     REAL NOT NULL DEFAULT 0.5,
            created_at     TEXT NOT NULL,
            last_accessed  TEXT NOT NULL,
            access_count   INTEGER NOT NULL DEFAULT 0
        );

        -- Goal history — every goal the brain has ever processed
        CREATE TABLE IF NOT EXISTS brain_goals (
            id              TEXT PRIMARY KEY NOT NULL,
            description     TEXT NOT NULL,
            context         TEXT,
            status          TEXT NOT NULL DEFAULT 'planning',
            plan_json       TEXT,
            result_summary  TEXT,
            created_at      TEXT NOT NULL,
            completed_at    TEXT,
            total_steps     INTEGER NOT NULL DEFAULT 0,
            completed_steps INTEGER NOT NULL DEFAULT 0,
            revision        INTEGER NOT NULL DEFAULT 0
        );

        -- Execution log — every step ever executed
        CREATE TABLE IF NOT EXISTS brain_execution_log (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id        TEXT NOT NULL,
            step_id        INTEGER NOT NULL,
            action_type    TEXT NOT NULL,
            description    TEXT NOT NULL,
            status         TEXT NOT NULL,
            output         TEXT,
            error          TEXT,
            duration_ms    INTEGER NOT NULL DEFAULT 0,
            provider_used  TEXT,
            executed_at    TEXT NOT NULL,
            FOREIGN KEY (goal_id) REFERENCES brain_goals(id)
        );
        ",
    )?;

    Ok(())
}
