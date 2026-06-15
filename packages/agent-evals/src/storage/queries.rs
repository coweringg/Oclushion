use crate::ab_testing::experiment::Experiment;
use crate::engine::scorer::CompositeScore;
use crate::engine::trend_detector::TrendDirection;
use crate::storage::schema::{AgentDetail, LeaderboardEntry, MetricsSnapshot, Store};
use crate::AgentRole;

pub struct Queries;

impl Queries {
    pub fn top_agents(
        store: &Store,
        limit: usize,
        min_samples: usize,
    ) -> Vec<LeaderboardEntry> {
        let schema = store.read().expect("lock poisoned");
        let mut entries: Vec<LeaderboardEntry> = Vec::new();

        for role in AgentRole::all() {
            let snapshots: Vec<&MetricsSnapshot> = schema
                .metrics
                .iter()
                .filter(|m| m.agent_role == role)
                .collect();

            if snapshots.len() < min_samples {
                continue;
            }

            let composite = CompositeScore {
                score: snapshots.iter().map(|s| s.quality_score).sum::<f64>()
                    / snapshots.len() as f64
                    * 10.0,
                weights: crate::engine::scorer::Scorer::weights_for_role(&role),
                breakdown: std::collections::HashMap::new(),
                trend: None,
                samples: snapshots.len(),
            };

            let scores: Vec<f64> = schema
                .evals
                .iter()
                .filter(|e| {
                    e.weights
                        .keys()
                        .any(|k| k == "first_pass_compilation")
                })
                .map(|e| e.score)
                .collect();

            let trend = if scores.len() >= 2 {
                let current = scores[scores.len() - 1];
                let previous = scores[scores.len() - 2];
                let delta = if previous > 0.0 {
                    (current - previous) / previous * 100.0
                } else {
                    0.0
                };
                let direction = if delta > 0.0 {
                    TrendDirection::Up
                } else if delta < 0.0 {
                    TrendDirection::Down
                } else {
                    TrendDirection::Stable
                };
                Some(direction.to_string())
            } else {
                None
            };

            entries.push(LeaderboardEntry {
                agent_role: role,
                composite_score: composite.score,
                samples: snapshots.len(),
                trend_direction: trend.unwrap_or_else(|| "Stable".to_string()),
            });
        }

        entries.sort_by(|a, b| {
            b.composite_score
                .partial_cmp(&a.composite_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        entries.truncate(limit);
        entries
    }

    pub fn agent_history(
        store: &Store,
        agent: &AgentRole,
        limit: usize,
    ) -> Vec<MetricsSnapshot> {
        let schema = store.read().expect("lock poisoned");
        let mut snapshots: Vec<MetricsSnapshot> = schema
            .metrics
            .iter()
            .filter(|m| m.agent_role == *agent)
            .cloned()
            .collect();
        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        snapshots.truncate(limit);
        snapshots
    }

    pub fn agent_detail(store: &Store, agent: &AgentRole) -> Option<AgentDetail> {
        let schema = store.read().expect("lock poisoned");
        let snapshots: Vec<&MetricsSnapshot> = schema
            .metrics
            .iter()
            .filter(|m| m.agent_role == *agent)
            .collect();

        if snapshots.is_empty() {
            return None;
        }

        let total_tasks = snapshots.len();
        let avg_quality = snapshots.iter().map(|s| s.quality_score).sum::<f64>()
            / total_tasks as f64;
        let first_pass_count = snapshots
            .iter()
            .filter(|s| s.metrics.first_pass_compilation)
            .count();
        let first_pass_rate = first_pass_count as f64 / total_tasks as f64;
        let avg_time = snapshots.iter().map(|s| s.metrics.time_to_completion_s).sum::<f64>()
            / total_tasks as f64;

        let recent_scores: Vec<CompositeScore> = schema
            .evals
            .iter()
            .filter(|e| {
                e.breakdown.contains_key("first_pass_compilation")
                    || e.breakdown.contains_key("bug_detection_precision")
            })
            .cloned()
            .collect();

        Some(AgentDetail {
            agent_role: agent.clone(),
            recent_scores,
            total_tasks,
            avg_quality_score: avg_quality,
            first_pass_rate,
            avg_time_to_completion: avg_time,
        })
    }

    pub fn failures(store: &Store, agent: Option<&AgentRole>, limit: usize) -> Vec<MetricsSnapshot> {
        let schema = store.read().expect("lock poisoned");
        let mut snapshots: Vec<MetricsSnapshot> = schema
            .metrics
            .iter()
            .filter(|m| {
                let role_match = agent.map_or(true, |a| m.agent_role == *a);
                role_match && !m.metrics.first_pass_compilation
            })
            .cloned()
            .collect();
        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        snapshots.truncate(limit);
        snapshots
    }

    pub fn get_experiments(store: &Store) -> Vec<Experiment> {
        let schema = store.read().expect("lock poisoned");
        schema.ab_tests.clone()
    }

    pub fn get_experiment(store: &Store, id: &str) -> Option<Experiment> {
        let schema = store.read().expect("lock poisoned");
        schema.ab_tests.iter().find(|e| e.id == id).cloned()
    }
}
