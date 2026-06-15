use agent_evals::ab_testing::analysis::Analysis;
use agent_evals::ab_testing::experiment::{Experiment, ExperimentResults};
use agent_evals::ab_testing::traffic_splitter::TrafficSplitter;

#[test]
fn test_experiment_new() {
    let exp = Experiment::new("test-ab", "control", "treatment");
    assert_eq!(exp.name, "test-ab");
    assert_eq!(exp.variant_a(), "control");
    assert_eq!(exp.variant_b(), "treatment");
    assert!(exp.is_active);
    assert_eq!(exp.min_samples, 30);
}

#[test]
fn test_experiment_is_complete_incomplete() {
    let exp = Experiment::new("test", "A", "B");
    assert!(!exp.is_complete());
}

#[test]
fn test_experiment_add_score() {
    let mut exp = Experiment::new("test", "A", "B");
    exp.results = Some(ExperimentResults {
        variant_a_scores: Vec::new(),
        variant_b_scores: Vec::new(),
        u_statistic: 0.0,
        p_value: 0.0,
        confidence_interval: (0.0, 0.0),
        effect_size: 0.0,
        winner: None,
    });
    exp.add_score("task-1", "A", 0.8);
    assert_eq!(exp.task_count, 1);
    let scores = exp.variant_scores();
    assert_eq!(scores.0.len(), 1);
}

#[test]
fn test_experiment_scores_no_results() {
    let exp = Experiment::new("test", "A", "B");
    let (a, b) = exp.variant_scores();
    assert!(a.is_empty());
    assert!(b.is_empty());
}

#[test]
fn test_traffic_splitter_assign() {
    let exp = Experiment::new("test", "control", "treatment");
    let assignment = TrafficSplitter::assign(&exp, "task-1");
    assert!(assignment == "control" || assignment == "treatment");
}

#[test]
fn test_traffic_splitter_assign_deterministic() {
    let exp = Experiment::new("test", "A", "B");
    let a1 = TrafficSplitter::assign(&exp, "task-1");
    let a2 = TrafficSplitter::assign(&exp, "task-1");
    assert_eq!(a1, a2);
}

#[test]
fn test_traffic_splitter_assignment_counts_empty() {
    let exp = Experiment::new("test", "A", "B");
    let (a, b) = TrafficSplitter::assignment_counts(&exp);
    assert_eq!(a, 0);
    assert_eq!(b, 0);
}

#[test]
fn test_traffic_splitter_balance_ratio_empty() {
    let exp = Experiment::new("test", "A", "B");
    let ratio = TrafficSplitter::balance_ratio(&exp);
    assert!((ratio - 1.0).abs() < 1e-10);
}

#[test]
fn test_analysis_needs_min_samples() {
    let mut exp = Experiment::new("test", "A", "B");
    exp.results = Some(ExperimentResults {
        variant_a_scores: vec![0.5; 5],
        variant_b_scores: vec![0.6; 5],
        u_statistic: 0.0,
        p_value: 0.0,
        confidence_interval: (0.0, 0.0),
        effect_size: 0.0,
        winner: None,
    });
    let result = Analysis::run(&mut exp);
    assert!(result.is_none());
}

#[test]
fn test_analysis_has_min_samples() {
    let mut exp = Experiment::new("test", "A", "B");
    exp.results = Some(ExperimentResults {
        variant_a_scores: vec![0.5; 30],
        variant_b_scores: vec![0.6; 30],
        u_statistic: 0.0,
        p_value: 0.0,
        confidence_interval: (0.0, 0.0),
        effect_size: 0.0,
        winner: None,
    });
    assert!(Analysis::has_min_samples(&exp));
}

#[test]
fn test_analysis_sample_sizes() {
    let mut exp = Experiment::new("test", "A", "B");
    exp.results = Some(ExperimentResults {
        variant_a_scores: vec![0.5; 10],
        variant_b_scores: vec![0.6; 20],
        u_statistic: 0.0,
        p_value: 0.0,
        confidence_interval: (0.0, 0.0),
        effect_size: 0.0,
        winner: None,
    });
    let (a, b) = Analysis::sample_sizes(&exp);
    assert_eq!(a, 10);
    assert_eq!(b, 20);
}
