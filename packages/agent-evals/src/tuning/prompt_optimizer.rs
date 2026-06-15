use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::storage::schema::Store;
use crate::AgentRole;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptEntry {
    pub version: usize,
    pub agent_role: AgentRole,
    pub prompt_text: String,
    pub timestamp: i64,
    pub first_pass_rate: f64,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptOptimizer {
    entries: Vec<PromptEntry>,
    current_version: usize,
}

impl PromptOptimizer {
    pub fn new() -> Self {
        PromptOptimizer {
            entries: Vec::new(),
            current_version: 0,
        }
    }

    pub fn record_prompt(
        &mut self,
        agent_role: AgentRole,
        prompt_text: String,
        first_pass_rate: f64,
        notes: String,
    ) -> usize {
        self.current_version += 1;
        let entry = PromptEntry {
            version: self.current_version,
            agent_role,
            prompt_text,
            timestamp: Utc::now().timestamp(),
            first_pass_rate,
            notes,
        };
        self.entries.push(entry);
        self.current_version
    }

    pub fn history(&self) -> &[PromptEntry] {
        &self.entries
    }

    pub fn history_for_agent(&self, agent: &AgentRole) -> Vec<&PromptEntry> {
        self.entries
            .iter()
            .filter(|e| e.agent_role == *agent)
            .collect()
    }

    pub fn rollback(&mut self, version: usize) -> Option<&PromptEntry> {
        if let Some(pos) = self.entries.iter().position(|e| e.version == version) {
            self.entries.truncate(pos + 1);
            self.current_version = version;
            self.entries.last()
        } else {
            None
        }
    }

    pub fn suggest_adjustments(&self, store: &Store) -> Vec<String> {
        let mut suggestions = Vec::new();
        for agent in AgentRole::all() {
            let schema = store.read().expect("lock poisoned");
            let snapshots: Vec<&crate::storage::schema::MetricsSnapshot> = schema
                .metrics
                .iter()
                .filter(|m| m.agent_role == agent)
                .collect();
            if snapshots.is_empty() {
                continue;
            }
            let fp_count = snapshots
                .iter()
                .filter(|m| m.metrics.first_pass_compilation)
                .count();
            let fp_rate = fp_count as f64 / snapshots.len() as f64;

            if fp_rate < 0.7 {
                suggestions.push(format!(
                    "Agent {:?} first-pass compilation rate is {:.1}% (<70%). Consider: providing more context, breaking down tasks, adding examples, or tightening instructions.",
                    agent, fp_rate * 100.0
                ));
            }
        }
        suggestions
    }

    pub fn current_version(&self) -> usize {
        self.current_version
    }

    pub fn latest_entry(&self) -> Option<&PromptEntry> {
        self.entries.last()
    }

    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }
}

impl Default for PromptOptimizer {
    fn default() -> Self {
        Self::new()
    }
}
