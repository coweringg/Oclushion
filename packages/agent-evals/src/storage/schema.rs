use std::sync::{Arc, RwLock};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::ab_testing::experiment::Experiment;
use crate::collector::task_metrics::TaskMetrics;
use crate::engine::scorer::CompositeScore;
use crate::AgentRole;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub id: String,
    pub task_id: String,
    pub agent_role: AgentRole,
    pub timestamp: i64,
    pub metrics: TaskMetrics,
    pub quality_score: f64,
    pub tokens_consumed: f64,
}

impl MetricsSnapshot {
    pub fn new(
        task_id: String,
        agent_role: AgentRole,
        metrics: TaskMetrics,
        tokens_consumed: f64,
    ) -> Self {
        let quality_score = metrics.quality_score();
        MetricsSnapshot {
            id: Uuid::new_v4().to_string(),
            task_id,
            agent_role,
            timestamp: Utc::now().timestamp(),
            metrics,
            quality_score,
            tokens_consumed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub tasks: Vec<MetricsSnapshot>,
    pub metrics: Vec<MetricsSnapshot>,
    pub evals: Vec<CompositeScore>,
    pub ab_tests: Vec<Experiment>,
    pub version: usize,
}

impl Schema {
    pub fn new() -> Self {
        Schema {
            tasks: Vec::new(),
            metrics: Vec::new(),
            evals: Vec::new(),
            ab_tests: Vec::new(),
            version: 0,
        }
    }

    pub fn add_snapshot(&mut self, snapshot: MetricsSnapshot) {
        self.tasks.push(snapshot.clone());
        self.metrics.push(snapshot);
    }

    pub fn add_composite_score(&mut self, score: CompositeScore) {
        self.evals.push(score);
    }

    pub fn add_experiment(&mut self, experiment: Experiment) {
        self.ab_tests.push(experiment);
    }

    pub fn update_experiment(&mut self, experiment: Experiment) {
        if let Some(existing) = self
            .ab_tests
            .iter_mut()
            .find(|e| e.id == experiment.id)
        {
            *existing = experiment;
        }
    }
}

impl Default for Schema {
    fn default() -> Self {
        Self::new()
    }
}

pub type Store = Arc<RwLock<Schema>>;

pub fn new_store() -> Store {
    Arc::new(RwLock::new(Schema::new()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub agent_role: AgentRole,
    pub composite_score: f64,
    pub samples: usize,
    pub trend_direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDetail {
    pub agent_role: AgentRole,
    pub recent_scores: Vec<CompositeScore>,
    pub total_tasks: usize,
    pub avg_quality_score: f64,
    pub first_pass_rate: f64,
    pub avg_time_to_completion: f64,
}
