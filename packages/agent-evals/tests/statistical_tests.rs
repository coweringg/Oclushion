use agent_evals::engine::statistical_tests::StatisticalTests;

#[test]
fn test_mann_whitney_basic() {
    let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let b = vec![6.0, 7.0, 8.0, 9.0, 10.0];
    let result = StatisticalTests::mann_whitney_u(&a, &b);
    assert!(result.is_some());
    let r = result.unwrap();
    assert!(r.u_statistic >= 0.0);
    assert!(r.p_value >= 0.0 && r.p_value <= 1.0);
}

#[test]
fn test_mann_whitney_too_small() {
    let a = vec![1.0];
    let b = vec![2.0];
    let result = StatisticalTests::mann_whitney_u(&a, &b);
    assert!(result.is_none());
}

#[test]
fn test_mann_whitney_identical() {
    let a = vec![5.0, 5.0, 5.0, 5.0, 5.0];
    let b = vec![5.0, 5.0, 5.0, 5.0, 5.0];
    let result = StatisticalTests::mann_whitney_u(&a, &b);
    assert!(result.is_some());
    let r = result.unwrap();
    assert!(r.p_value > 0.05);
}

#[test]
fn test_mann_whitney_different() {
    let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
    let b = vec![20.0, 21.0, 22.0, 23.0, 24.0, 25.0, 26.0, 27.0, 28.0, 29.0];
    let result = StatisticalTests::mann_whitney_u(&a, &b);
    assert!(result.is_some());
    let r = result.unwrap();
    assert!(r.u_statistic >= 0.0);
}

#[test]
fn test_min_samples_requirement() {
    assert_eq!(StatisticalTests::MIN_SAMPLES, 30);
}

#[test]
fn test_has_sufficient_samples() {
    let a = vec![0.0; 30];
    let b = vec![0.0; 30];
    assert!(StatisticalTests::has_sufficient_samples(&a, &b));
}

#[test]
fn test_has_insufficient_samples() {
    let a = vec![0.0; 29];
    let b = vec![0.0; 30];
    assert!(!StatisticalTests::has_sufficient_samples(&a, &b));
}

#[test]
fn test_large_sample_mann_whitney() {
    let a: Vec<f64> = (0..30).map(|i| i as f64).collect();
    let b: Vec<f64> = (30..60).map(|i| i as f64).collect();
    let result = StatisticalTests::mann_whitney_u(&a, &b);
    assert!(result.is_some());
    let r = result.unwrap();
    assert!(r.confidence_interval.0 <= r.confidence_interval.1);
    assert!(r.effect_size >= 0.0);
}

#[test]
fn test_mann_whitney_effect_size_range() {
    let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
    let b = vec![11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0];
    let result = StatisticalTests::mann_whitney_u(&a, &b).unwrap();
    assert!(result.effect_size >= 0.0);
    assert!(result.effect_size <= 1.0);
}
