use std::collections::BTreeMap;

use chrono::Utc;

use crate::engine::scorer::{CompositeScore, Scorer};
use crate::storage::schema::{MetricsSnapshot, Store};
use crate::AgentRole;

pub enum Period {
    Day,
    Week,
    Month,
}

pub struct Aggregator;

impl Aggregator {
    pub fn by_period(
        store: &Store,
        period: &Period,
        agent: Option<&AgentRole>,
    ) -> Vec<(i64, CompositeScore)> {
        let schema = store.read().expect("lock poisoned");
        let period_seconds = match period {
            Period::Day => 86400i64,
            Period::Week => 604800i64,
            Period::Month => 2592000i64,
        };

        let now = Utc::now().timestamp();
        let mut buckets: BTreeMap<i64, Vec<MetricsSnapshot>> = BTreeMap::new();

        for snapshot in &schema.metrics {
            if let Some(agent) = agent {
                if &snapshot.agent_role != agent {
                    continue;
                }
            }
            let elapsed = now - snapshot.timestamp;
            let periods_ago = if period_seconds > 0 {
                elapsed / period_seconds
            } else {
                0
            };
            let bucket_start = now - (periods_ago + 1) * period_seconds;
            buckets.entry(bucket_start).or_default().push(snapshot.clone());
        }

        buckets
            .into_iter()
            .map(|(ts, snapshots)| {
                let scores: Vec<CompositeScore> = snapshots
                    .iter()
                    .map(|s| Scorer::composite_score(s))
                    .collect();
                let avg = Scorer::average_composite_score(&scores)
                    .unwrap_or_else(|| CompositeScore {
                        score: 0.0,
                        weights: std::collections::HashMap::new(),
                        breakdown: std::collections::HashMap::new(),
                        trend: None,
                        samples: 0,
                    });
                (ts, avg)
            })
            .collect()
    }

    pub fn by_day(
        store: &Store,
        agent: Option<&AgentRole>,
    ) -> Vec<(i64, CompositeScore)> {
        Self::by_period(store, &Period::Day, agent)
    }

    pub fn by_week(
        store: &Store,
        agent: Option<&AgentRole>,
    ) -> Vec<(i64, CompositeScore)> {
        Self::by_period(store, &Period::Week, agent)
    }

    pub fn by_month(
        store: &Store,
        agent: Option<&AgentRole>,
    ) -> Vec<(i64, CompositeScore)> {
        Self::by_period(store, &Period::Month, agent)
    }

    pub fn overall(store: &Store, agent: Option<&AgentRole>) -> CompositeScore {
        let schema = store.read().expect("lock poisoned");
        let snapshots: Vec<&MetricsSnapshot> = schema
            .metrics
            .iter()
            .filter(|m| agent.map_or(true, |a| &m.agent_role == a))
            .collect();

        if snapshots.is_empty() {
            return CompositeScore {
                score: 0.0,
                weights: std::collections::HashMap::new(),
                breakdown: std::collections::HashMap::new(),
                trend: None,
                samples: 0,
            };
        }

        let scores: Vec<CompositeScore> = snapshots
            .iter()
            .map(|s| Scorer::composite_score(s))
            .collect();
        Scorer::average_composite_score(&scores).unwrap()
    }
}
