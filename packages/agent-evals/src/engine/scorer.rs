use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::engine::trend_detector::TrendResult;
use crate::AgentRole;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeScore {
    pub score: f64,
    pub weights: HashMap<String, f64>,
    pub breakdown: HashMap<String, f64>,
    pub trend: Option<TrendResult>,
    pub samples: usize,
}

pub struct Scorer;

impl Scorer {
    pub fn weights_for_role(role: &AgentRole) -> HashMap<String, f64> {
        match role {
            AgentRole::Builder => {
                let mut w = HashMap::new();
                w.insert("first_pass_compilation".to_string(), 0.40);
                w.insert("user_acceptance_rate".to_string(), 0.30);
                w.insert("token_efficiency".to_string(), 0.20);
                w.insert("time_to_completion_s".to_string(), 0.10);
                w
            }
            AgentRole::Reviewer => {
                let mut w = HashMap::new();
                w.insert("bug_detection_precision".to_string(), 0.50);
                w.insert("false_positive_rate".to_string(), 0.30);
                w.insert("time_to_completion_s".to_string(), 0.20);
                w
            }
            _ => {
                let mut w = HashMap::new();
                w.insert("plan_success_rate".to_string(), 0.30);
                w.insert("user_acceptance_rate".to_string(), 0.25);
                w.insert("token_efficiency".to_string(), 0.20);
                w.insert("time_to_completion_s".to_string(), 0.15);
                w.insert("cost_per_task".to_string(), 0.10);
                w
            }
        }
    }

    pub fn composite_score(snapshot: &crate::storage::schema::MetricsSnapshot) -> CompositeScore {
        let role = &snapshot.agent_role;
        let weights = Self::weights_for_role(role);
        let metrics = &snapshot.metrics;
        let mut breakdown = HashMap::new();
        let mut total_score = 0.0;

        for (key, weight) in &weights {
            let value = match key.as_str() {
                "first_pass_compilation" => {
                    if metrics.first_pass_compilation { 1.0 } else { 0.0 }
                }
                "bug_detection_precision" => metrics.bug_detection_precision,
                "false_positive_rate" => 1.0 - metrics.false_positive_rate,
                "plan_success_rate" => metrics.plan_success_rate,
                "time_to_completion_s" => {
                    let normalized = (300.0 - metrics.time_to_completion_s) / 300.0;
                    normalized.max(0.0).min(1.0)
                }
                "token_efficiency" => metrics.token_efficiency.min(1.0),
                "cost_per_task" => {
                    let normalized = (1.0 - metrics.cost_per_task).max(0.0);
                    normalized.min(1.0)
                }
                "user_acceptance_rate" => metrics.user_acceptance_rate,
                "visual_qa_pass_rate" => metrics.visual_qa_pass_rate,
                "savings_accuracy" => metrics.savings_accuracy,
                _ => 0.0,
            };
            breakdown.insert(key.clone(), value);
            total_score += value * weight;
        }

        let score = (total_score * 10.0).max(0.0).min(10.0);

        CompositeScore {
            score,
            weights,
            breakdown,
            trend: None,
            samples: 1,
        }
    }

    pub fn average_composite_score(scores: &[CompositeScore]) -> Option<CompositeScore> {
        if scores.is_empty() {
            return None;
        }
        let first = &scores[0];
        let weights = first.weights.clone();
        let mut breakdown = HashMap::new();

        for key in weights.keys() {
            let sum: f64 = scores.iter().map(|s| s.breakdown.get(key).copied().unwrap_or(0.0)).sum();
            breakdown.insert(key.clone(), sum / scores.len() as f64);
        }

        let total_score: f64 = weights
            .iter()
            .map(|(key, w)| breakdown.get(key).copied().unwrap_or(0.0) * w)
            .sum();
        let score = (total_score * 10.0).max(0.0).min(10.0);

        Some(CompositeScore {
            score,
            weights,
            breakdown,
            trend: None,
            samples: scores.len(),
        })
    }
}
