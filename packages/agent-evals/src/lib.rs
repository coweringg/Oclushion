pub mod collector;
pub mod storage;
pub mod engine;
pub mod ab_testing;
pub mod tuning;
pub mod bridge;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentRole {
    Architect,
    Builder,
    Reviewer,
    Qa,
    Docs,
    Security,
    FinOps,
}

impl AgentRole {
    pub fn all() -> Vec<AgentRole> {
        vec![
            AgentRole::Architect,
            AgentRole::Builder,
            AgentRole::Reviewer,
            AgentRole::Qa,
            AgentRole::Docs,
            AgentRole::Security,
            AgentRole::FinOps,
        ]
    }
}
