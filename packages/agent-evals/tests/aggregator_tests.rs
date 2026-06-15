use agent_evals::collector::task_metrics::TaskMetrics;
use agent_evals::engine::aggregator::Aggregator;
use agent_evals::engine::scorer::Scorer;
use agent_evals::storage::schema::{MetricsSnapshot, new_store};
use agent_evals::AgentRole;

fn create_snapshot(role: AgentRole, fp: bool, time_s: f64) -> MetricsSnapshot {
    let mut metrics = TaskMetrics::new();
    metrics.first_pass_compilation = fp;
    metrics.time_to_completion_s = time_s;
    metrics.user_acceptance_rate = 0.9;
    metrics.plan_success_rate = 0.85;
    metrics.bug_detection_precision = 0.8;
    metrics.token_efficiency = 0.7;
    MetricsSnapshot::new("task-1".into(), role, metrics, 500.0)
}

#[test]
fn test_aggregator_overall_empty() {
    let store = new_store();
    let result = Aggregator::overall(&store, None);
    assert_eq!(result.samples, 0);
    assert!((result.score - 0.0).abs() < 1e-10);
}

#[test]
fn test_aggregator_overall_single_agent() {
    let store = new_store();
    {
        let mut schema = store.write().unwrap();
        schema.add_snapshot(create_snapshot(AgentRole::Builder, true, 120.0));
    }
    let result = Aggregator::overall(&store, Some(&AgentRole::Builder));
    assert_eq!(result.samples, 1);
    assert!(result.score > 0.0);
}

#[test]
fn test_aggregator_overall_all() {
    let store = new_store();
    {
        let mut schema = store.write().unwrap();
        schema.add_snapshot(create_snapshot(AgentRole::Builder, true, 100.0));
        schema.add_snapshot(create_snapshot(AgentRole::Reviewer, false, 200.0));
    }
    let result = Aggregator::overall(&store, None);
    assert_eq!(result.samples, 2);
    assert!(result.score > 0.0);
}

#[test]
fn test_aggregator_by_day() {
    let store = new_store();
    {
        let mut schema = store.write().unwrap();
        schema.add_snapshot(create_snapshot(AgentRole::Builder, true, 100.0));
    }
    let periods = Aggregator::by_day(&store, Some(&AgentRole::Builder));
    assert!(!periods.is_empty());
    assert!(periods[0].1.score > 0.0);
}

#[test]
fn test_scorer_builder_weights() {
    let weights = Scorer::weights_for_role(&AgentRole::Builder);
    let sum: f64 = weights.values().sum();
    assert!((sum - 1.0).abs() < 1e-10);
}

#[test]
fn test_scorer_reviewer_weights() {
    let weights = Scorer::weights_for_role(&AgentRole::Reviewer);
    let sum: f64 = weights.values().sum();
    assert!((sum - 1.0).abs() < 1e-10);
}

#[test]
fn test_scorer_composite() {
    let snapshot = create_snapshot(AgentRole::Builder, true, 100.0);
    let score = Scorer::composite_score(&snapshot);
    assert!(score.score > 0.0);
    assert!(score.score <= 10.0);
    assert_eq!(score.samples, 1);
}

#[test]
fn test_scorer_average() {
    let snapshots = vec![
        create_snapshot(AgentRole::Builder, true, 100.0),
        create_snapshot(AgentRole::Builder, false, 200.0),
    ];
    let scores: Vec<_> = snapshots.iter().map(|s| Scorer::composite_score(s)).collect();
    let avg = Scorer::average_composite_score(&scores).unwrap();
    assert_eq!(avg.samples, 2);
}
