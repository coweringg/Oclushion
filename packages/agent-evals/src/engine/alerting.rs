use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::engine::trend_detector::TrendDetector;
use crate::storage::schema::Store;
use crate::AgentRole;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub agent: AgentRole,
    pub severity: AlertSeverity,
    pub message: String,
    pub timestamp: i64,
}

pub struct Alerting;

impl Alerting {
    pub fn check_degradation(store: &Store) -> Vec<Alert> {
        let mut alerts = Vec::new();
        let now = Utc::now().timestamp();

        for agent in AgentRole::all() {
            if let Some(trend) = TrendDetector::for_agent(store, &agent) {
                if trend.is_degraded {
                    let severity = if trend.delta_pct < -30.0 {
                        AlertSeverity::Critical
                    } else if trend.delta_pct < -20.0 {
                        AlertSeverity::Warning
                    } else {
                        AlertSeverity::Info
                    };

                    alerts.push(Alert {
                        agent: agent.clone(),
                        severity,
                        message: format!(
                            "Agent {:?} score dropped by {:.1}% ({:?})",
                            agent, trend.delta_pct, trend.direction
                        ),
                        timestamp: now,
                    });
                }
            }
        }

        alerts
    }

    pub fn check_first_pass_threshold(store: &Store, threshold: f64) -> Vec<Alert> {
        let mut alerts = Vec::new();
        let now = Utc::now().timestamp();

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

            if fp_rate < threshold {
                alerts.push(Alert {
                    agent: agent.clone(),
                    severity: AlertSeverity::Warning,
                    message: format!(
                        "Agent {:?} first-pass compilation rate is {:.1}% (threshold: {:.0}%)",
                        agent,
                        fp_rate * 100.0,
                        threshold * 100.0
                    ),
                    timestamp: now,
                });
            }
        }

        alerts
    }

    pub fn all_active_alerts(store: &Store) -> Vec<Alert> {
        let mut alerts = Self::check_degradation(store);
        alerts.extend(Self::check_first_pass_threshold(store, 0.7));
        alerts
    }
}
