use serde::{Deserialize, Serialize};

use crate::engine::scorer::CompositeScore;
use crate::storage::schema::Store;
use crate::AgentRole;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TrendDirection {
    Up,
    Down,
    Stable,
}

impl TrendDirection {
    pub fn to_string(&self) -> String {
        match self {
            TrendDirection::Up => "Up".to_string(),
            TrendDirection::Down => "Down".to_string(),
            TrendDirection::Stable => "Stable".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendResult {
    pub direction: TrendDirection,
    pub delta_pct: f64,
    pub is_degraded: bool,
}

pub struct TrendDetector;

impl TrendDetector {
    pub fn compare(
        current: &CompositeScore,
        previous: &CompositeScore,
    ) -> TrendResult {
        let delta = current.score - previous.score;
        let delta_pct = if previous.score > 0.0 {
            (delta / previous.score) * 100.0
        } else if delta > 0.0 {
            100.0
        } else {
            0.0
        };

        let direction = if delta_pct > 1.0 {
            TrendDirection::Up
        } else if delta_pct < -1.0 {
            TrendDirection::Down
        } else {
            TrendDirection::Stable
        };

        let is_degraded = delta_pct < -15.0;

        TrendResult {
            direction,
            delta_pct,
            is_degraded,
        }
    }

    pub fn for_agent(
        store: &Store,
        agent: &AgentRole,
    ) -> Option<TrendResult> {
        use crate::engine::aggregator::Aggregator;
        let periods = Aggregator::by_week(store, Some(agent));
        if periods.len() < 2 {
            return None;
        }
        let current = &periods[periods.len() - 1].1;
        let previous = &periods[periods.len() - 2].1;
        Some(Self::compare(current, previous))
    }

    pub fn check_degradation(
        store: &Store,
        threshold_pct: f64,
    ) -> Vec<(AgentRole, TrendResult)> {
        let mut degraded = Vec::new();
        for agent in AgentRole::all() {
            if let Some(trend) = Self::for_agent(store, &agent) {
                if trend.is_degraded && trend.delta_pct.abs() >= threshold_pct.abs() {
                    degraded.push((agent, trend));
                }
            }
        }
        degraded
    }
}
