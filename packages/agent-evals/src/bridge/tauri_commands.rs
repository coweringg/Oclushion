use crate::ab_testing::analysis::Analysis;
use crate::ab_testing::experiment::Experiment;
use crate::engine::aggregator::Aggregator;
use crate::engine::alerting::Alerting;
use crate::engine::scorer::CompositeScore;
use crate::storage::queries::Queries;
use crate::storage::schema::{AgentDetail, LeaderboardEntry, MetricsSnapshot, Store};
use crate::tuning::prompt_optimizer::{PromptEntry, PromptOptimizer};
use crate::AgentRole;

pub struct TauriCommands;

impl TauriCommands {
    pub fn get_leaderboard(
        store: &Store,
        limit: usize,
        min_samples: usize,
    ) -> Vec<LeaderboardEntry> {
        Queries::top_agents(store, limit, min_samples)
    }

    pub fn get_agent_detail(store: &Store, agent: AgentRole) -> Option<AgentDetail> {
        Queries::agent_detail(store, &agent)
    }

    pub fn get_trend_chart(
        store: &Store,
        agent: AgentRole,
        period: &str,
    ) -> Vec<(i64, CompositeScore)> {
        match period {
            "day" => Aggregator::by_day(store, Some(&agent)),
            "week" => Aggregator::by_week(store, Some(&agent)),
            "month" => Aggregator::by_month(store, Some(&agent)),
            _ => Vec::new(),
        }
    }

    pub fn get_ab_test_status(
        store: &Store,
        experiment_id: String,
    ) -> Option<Experiment> {
        Queries::get_experiment(store, &experiment_id)
    }

    pub fn run_ab_test(
        store: &Store,
        experiment_id: String,
    ) -> Result<String, String> {
        let mut schema = store.write().map_err(|e| e.to_string())?;
        let experiment = schema
            .ab_tests
            .iter_mut()
            .find(|e| e.id == experiment_id)
            .ok_or_else(|| "Experiment not found".to_string())?;

        if !experiment.is_active {
            return Err("Experiment is not active".to_string());
        }

        Analysis::run(experiment).ok_or_else(|| {
            "Insufficient samples (need at least 30 per variant)".to_string()
        })?;

        let winner = experiment
            .results
            .as_ref()
            .and_then(|r| r.winner.as_ref())
            .cloned()
            .unwrap_or_else(|| "No significant winner".to_string());

        Ok(winner)
    }

    pub fn get_prompt_history(
        optimizer: &PromptOptimizer,
        agent: Option<AgentRole>,
    ) -> Vec<PromptEntry> {
        match agent {
            Some(role) => optimizer
                .history_for_agent(&role)
                .into_iter()
                .cloned()
                .collect(),
            None => optimizer.history().to_vec(),
        }
    }

    pub fn rollback_prompt(
        optimizer: &mut PromptOptimizer,
        version: usize,
    ) -> Option<PromptEntry> {
        optimizer.rollback(version).cloned()
    }

    pub fn get_alerts(store: &Store) -> Vec<crate::engine::alerting::Alert> {
        Alerting::all_active_alerts(store)
    }

    pub fn get_failures(
        store: &Store,
        agent: Option<AgentRole>,
        limit: usize,
    ) -> Vec<MetricsSnapshot> {
        Queries::failures(store, agent.as_ref(), limit)
    }

    pub fn record_snapshot(store: &Store, snapshot: MetricsSnapshot) {
        let mut schema = store.write().expect("lock poisoned");
        schema.add_snapshot(snapshot);
    }

    pub fn create_experiment(
        store: &Store,
        name: String,
        variant_a: String,
        variant_b: String,
    ) -> String {
        let experiment = Experiment::new(&name, &variant_a, &variant_b);
        let id = experiment.id.clone();
        let mut schema = store.write().expect("lock poisoned");
        schema.add_experiment(experiment);
        id
    }
}
