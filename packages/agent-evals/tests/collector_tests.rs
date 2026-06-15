use agent_evals::collector::compilation_check::CompilationCheck;
use agent_evals::collector::diff_quality::DiffQuality;
use agent_evals::collector::task_metrics::TaskMetrics;
use agent_evals::collector::token_efficiency::TokenEfficiency;
use agent_evals::AgentRole;

#[test]
fn test_task_metrics_new() {
    let metrics = TaskMetrics::new();
    assert!(!metrics.first_pass_compilation);
    assert_eq!(metrics.bug_detection_precision, 0.0);
    assert_eq!(metrics.false_positive_rate, 0.0);
}

#[test]
fn test_task_metrics_quality_score() {
    let mut metrics = TaskMetrics::new();
    metrics.first_pass_compilation = true;
    metrics.user_acceptance_rate = 1.0;
    metrics.plan_success_rate = 1.0;
    let score = metrics.quality_score();
    assert!(score > 0.0);
    assert!(score <= 1.0);
}

#[test]
fn test_task_metrics_validate() {
    let metrics = TaskMetrics::new();
    assert!(metrics.validate().is_ok());

    let mut bad = TaskMetrics::new();
    bad.bug_detection_precision = 1.5;
    assert!(bad.validate().is_err());

    let mut bad2 = TaskMetrics::new();
    bad2.time_to_completion_s = -1.0;
    assert!(bad2.validate().is_err());
}

#[test]
fn test_compilation_check_empty() {
    let result = CompilationCheck::check("", &AgentRole::Builder);
    assert!(!result);
}

#[test]
fn test_compilation_check_balanced() {
    let result = CompilationCheck::check("fn main() { let x = 1; }", &AgentRole::Builder);
    assert!(result);
}

#[test]
fn test_compilation_check_unbalanced_braces() {
    let result = CompilationCheck::check("fn main() { let x = 1; ", &AgentRole::Builder);
    assert!(!result);
}

#[test]
fn test_compilation_check_with_detail() {
    let detail = CompilationCheck::check_with_detail("fn main() { let x = 1; ", &AgentRole::Builder);
    assert!(!detail.passed);
    assert!(!detail.issues.is_empty());
}

#[test]
fn test_compilation_check_string_literals() {
    let result = CompilationCheck::check("fn main() { let s = \"hello {\"; }", &AgentRole::Builder);
    assert!(result);
}

#[test]
fn test_diff_quality_ratio_perfect() {
    let ratio = DiffQuality::ratio(100, 100);
    assert!((ratio - 1.0).abs() < 1e-10);
}

#[test]
fn test_diff_quality_ratio_zero_needed() {
    let ratio = DiffQuality::ratio(0, 0);
    assert!((ratio - 1.0).abs() < 1e-10);
}

#[test]
fn test_diff_quality_ratio_over_100() {
    let ratio = DiffQuality::ratio(150, 100);
    assert!((ratio - 1.0).abs() < 1e-10);
}

#[test]
fn test_diff_quality_precision_recall() {
    let (p, r, f1) = DiffQuality::precision_recall(80, 100, 100);
    assert!((p - 0.8).abs() < 1e-10);
    assert!((r - 0.8).abs() < 1e-10);
    assert!((f1 - 0.8).abs() < 1e-10);
}

#[test]
fn test_token_efficiency_compute() {
    let eff = TokenEfficiency::compute(0.5, 1000.0);
    assert!((eff - 0.0005).abs() < 1e-10);
}

#[test]
fn test_token_efficiency_zero_tokens() {
    let eff = TokenEfficiency::compute(0.5, 0.0);
    assert_eq!(eff, 0.0);
}

#[test]
fn test_token_efficiency_per_1k() {
    let eff = TokenEfficiency::score_per_1k_tokens(0.5, 1000.0);
    assert!((eff - 0.5).abs() < 1e-10);
}
