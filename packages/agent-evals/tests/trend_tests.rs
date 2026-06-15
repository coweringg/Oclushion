use std::collections::HashMap;

use agent_evals::engine::scorer::CompositeScore;
use agent_evals::engine::trend_detector::{TrendDetector, TrendDirection};
use agent_evals::storage::schema::new_store;
use agent_evals::AgentRole;

fn make_score(score: f64) -> CompositeScore {
    CompositeScore {
        score,
        weights: HashMap::new(),
        breakdown: HashMap::new(),
        trend: None,
        samples: 1,
    }
}

#[test]
fn test_trend_compare_up() {
    let current = make_score(8.0);
    let previous = make_score(6.0);
    let trend = TrendDetector::compare(&current, &previous);
    assert_eq!(trend.direction, TrendDirection::Up);
    assert!(!trend.is_degraded);
}

#[test]
fn test_trend_compare_down() {
    let current = make_score(5.0);
    let previous = make_score(8.0);
    let trend = TrendDetector::compare(&current, &previous);
    assert_eq!(trend.direction, TrendDirection::Down);
}

#[test]
fn test_trend_compare_stable() {
    let current = make_score(7.5);
    let previous = make_score(7.55);
    let trend = TrendDetector::compare(&current, &previous);
    assert_eq!(trend.direction, TrendDirection::Stable);
}

#[test]
fn test_trend_degraded_threshold() {
    let current = make_score(5.0);
    let previous = make_score(10.0);
    let trend = TrendDetector::compare(&current, &previous);
    assert!(trend.is_degraded);
    assert!((trend.delta_pct - (-50.0)).abs() < 1.0);
}

#[test]
fn test_trend_not_degraded() {
    let current = make_score(9.0);
    let previous = make_score(10.0);
    let trend = TrendDetector::compare(&current, &previous);
    assert!(!trend.is_degraded);
}

#[test]
fn test_trend_no_data() {
    let store = new_store();
    let trend = TrendDetector::for_agent(&store, &AgentRole::Builder);
    assert!(trend.is_none());
}

#[test]
fn test_trend_check_degradation_empty() {
    let store = new_store();
    let degraded = TrendDetector::check_degradation(&store, 15.0);
    assert!(degraded.is_empty());
}

#[test]
fn test_trend_direction_to_string() {
    assert_eq!(TrendDirection::Up.to_string(), "Up");
    assert_eq!(TrendDirection::Down.to_string(), "Down");
    assert_eq!(TrendDirection::Stable.to_string(), "Stable");
}
