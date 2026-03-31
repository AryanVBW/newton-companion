use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Goal & Plan
// ---------------------------------------------------------------------------

/// A high-level goal the agent is trying to accomplish.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentGoal {
    pub id: String,
    pub description: String,
    pub context: Option<String>,
    pub created_at: DateTime<Utc>,
    pub status: GoalStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GoalStatus {
    Planning,
    Executing,
    Completed,
    Failed,
    Cancelled,
}

/// An ordered plan of steps to accomplish a goal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPlan {
    pub goal_id: String,
    pub steps: Vec<PlanStep>,
    pub reasoning: String,
    pub revision: u32,
    pub created_at: DateTime<Utc>,
}

/// A single step in a plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub id: u32,
    pub action: StepAction,
    pub description: String,
    pub depends_on: Vec<u32>,
    pub status: StepStatus,
    pub result: Option<StepResult>,
    pub retries: u32,
    pub max_retries: u32,
}

/// What kind of action a step performs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum StepAction {
    /// Call a tool on an MCP server
    ToolCall {
        tool_name: String,
        arguments: Value,
    },
    /// Ask an LLM to reason / generate / analyze
    LlmQuery {
        prompt: String,
        system_prompt: Option<String>,
        /// Optional: preferred provider for this step
        preferred_provider: Option<String>,
    },
    /// Synthesize results from previous steps into a final answer
    Synthesize {
        step_ids: Vec<u32>,
        instruction: String,
    },
    /// Run a shell command (guarded)
    ShellCommand {
        command: String,
        args: Vec<String>,
    },
    /// A conditional branch
    Conditional {
        condition: String,
        if_true: Vec<u32>,
        if_false: Vec<u32>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
    Retrying,
}

/// The result of executing a step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub output: String,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
    pub metadata: Option<Value>,
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/// A memory entry — can be short-term or long-term.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub category: MemoryCategory,
    pub content: String,
    pub context_tags: Vec<String>,
    pub importance: f64,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub access_count: u32,
    pub ttl_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryCategory {
    /// Current task context — cleared when task ends
    ShortTerm,
    /// Learned patterns that persist across sessions
    LearnedPattern,
    /// Project-specific knowledge
    ProjectKnowledge,
    /// Tool usage patterns (which tools work for which tasks)
    ToolPattern,
    /// Error patterns and their solutions
    ErrorSolution,
    /// User preferences observed over time
    UserPreference,
}

// ---------------------------------------------------------------------------
// Tool Routing
// ---------------------------------------------------------------------------

/// A tool available to the brain, with its source server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableTool {
    pub name: String,
    pub description: String,
    pub server_id: String,
    pub server_name: String,
    pub input_schema: Value,
}

/// Result from routing and executing a tool call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub tool_name: String,
    pub server_id: String,
    pub output: String,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

// ---------------------------------------------------------------------------
// Multi-LLM
// ---------------------------------------------------------------------------

/// A request to an LLM, potentially routable to different providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub messages: Vec<LlmMessage>,
    pub tools: Option<Vec<Value>>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    /// Hint about the task type for routing
    pub task_type: TaskType,
    /// Force a specific provider (bypasses routing)
    pub force_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    pub content: String,
    pub provider_used: String,
    pub model_used: String,
    pub tokens_used: Option<u32>,
    pub tool_calls: Option<Vec<Value>>,
}

/// Task classification — helps the coordinator pick the right LLM.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    /// Complex reasoning, planning, analysis
    Reasoning,
    /// Code generation
    Coding,
    /// Simple lookups, summarization
    Simple,
    /// Creative writing
    Creative,
    /// Tool use / function calling
    ToolUse,
}

// ---------------------------------------------------------------------------
// Brain Events — emitted to frontend for real-time updates
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "event", content = "data")]
pub enum BrainEvent {
    /// A new goal has been accepted
    GoalAccepted {
        goal_id: String,
        description: String,
    },
    /// Planning has started
    PlanningStarted {
        goal_id: String,
    },
    /// A plan has been generated
    PlanGenerated {
        goal_id: String,
        step_count: usize,
        reasoning: String,
    },
    /// A plan step is starting
    StepStarted {
        goal_id: String,
        step_id: u32,
        description: String,
    },
    /// A plan step has completed
    StepCompleted {
        goal_id: String,
        step_id: u32,
        success: bool,
        output_preview: String,
    },
    /// A step failed and healing is being attempted
    StepHealing {
        goal_id: String,
        step_id: u32,
        error: String,
        strategy: String,
    },
    /// Re-planning due to failure or context change
    Replanning {
        goal_id: String,
        reason: String,
    },
    /// The goal has been fully completed
    GoalCompleted {
        goal_id: String,
        summary: String,
    },
    /// The goal has failed after all recovery attempts
    GoalFailed {
        goal_id: String,
        error: String,
    },
    /// A memory has been created or updated
    MemoryUpdated {
        entry_id: String,
        category: String,
    },
    /// LLM provider was switched during execution
    ProviderSwitched {
        from: String,
        to: String,
        reason: String,
    },
    /// Progress heartbeat
    Progress {
        goal_id: String,
        completed_steps: usize,
        total_steps: usize,
        current_step: Option<String>,
    },
}

// ---------------------------------------------------------------------------
// Healing
// ---------------------------------------------------------------------------

/// A healing strategy the self-healer can attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealingStrategy {
    pub name: String,
    pub description: String,
    pub action: HealingAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum HealingAction {
    /// Retry the same step with same parameters
    Retry,
    /// Retry with modified arguments
    RetryModified { new_arguments: Value },
    /// Use a different tool for the same purpose
    AlternativeTool { tool_name: String, arguments: Value },
    /// Switch to a different LLM provider
    SwitchProvider { provider: String },
    /// Re-prompt with clarified instructions
    Reprompt { new_prompt: String },
    /// Skip this step and continue
    Skip { reason: String },
    /// Trigger a full replan from the current state
    Replan { context: String },
}

// ---------------------------------------------------------------------------
// Brain Status — queryable snapshot of the brain's current state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainStatus {
    pub active_goal: Option<AgentGoal>,
    pub current_plan: Option<AgentPlan>,
    pub is_running: bool,
    pub total_goals_completed: u32,
    pub memory_entries: u32,
    pub available_tools: Vec<String>,
    pub configured_providers: Vec<String>,
}
