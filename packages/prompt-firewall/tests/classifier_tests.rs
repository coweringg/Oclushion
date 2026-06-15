use prompt_firewall::pipeline::classifier::LocalClassifier;
use prompt_firewall::pipeline::result::PhaseResult;
use prompt_firewall::Verdict;

#[test]
fn test_safe_classification() {
    let classifier = LocalClassifier::new();
    let phases = vec![
        PhaseResult {
            phase_name: "pattern_matcher".into(),
            score: 0.0,
            details: "".into(),
            matches: vec![],
        },
        PhaseResult {
            phase_name: "invisible_chars".into(),
            score: 0.0,
            details: "".into(),
            matches: vec![],
        },
    ];
    let result = classifier.classify(&phases);
    assert_eq!(result.verdict, Verdict::Safe);
    assert!(result.probability < 0.7);
}

#[test]
fn test_suspicious_classification() {
    let classifier = LocalClassifier::new();
    let phases = vec![
        PhaseResult {
            phase_name: "pattern_matcher".into(),
            score: 0.9,
            details: "High pattern match".into(),
            matches: vec![],
        },
        PhaseResult {
            phase_name: "invisible_chars".into(),
            score: 0.5,
            details: "Invisible chars found".into(),
            matches: vec![],
        },
    ];
    let result = classifier.classify(&phases);
    assert_eq!(result.verdict, Verdict::Suspicious);
    assert!(result.probability >= 0.7);
}

#[test]
fn test_custom_threshold() {
    let classifier = LocalClassifier::with_threshold(0.5);
    let phases = vec![
        PhaseResult {
            phase_name: "pattern_matcher".into(),
            score: 0.6,
            details: "".into(),
            matches: vec![],
        },
    ];
    let result = classifier.classify(&phases);
    assert_eq!(result.verdict, Verdict::Suspicious);
}

#[test]
fn test_classify_full_suspicious() {
    let classifier = LocalClassifier::new();
    let result = classifier.classify_full(
        &[],
        10,
        &[0.95, 0.85],
        true,
    );
    assert_eq!(result.verdict, Verdict::Suspicious);
    assert!(result.probability >= 0.7);
}

#[test]
fn test_classify_full_safe() {
    let classifier = LocalClassifier::new();
    let result = classifier.classify_full(
        &[],
        0,
        &[0.0],
        false,
    );
    assert_eq!(result.verdict, Verdict::Safe);
    assert!(result.probability < 0.7);
}

#[test]
fn test_classify_verdict_critical() {
    let classifier = LocalClassifier::new();
    let (verdict, severity, _) = classifier.classify_verdict(0.95);
    assert_eq!(verdict, prompt_firewall::Verdict::Quarantined);
    assert_eq!(severity, prompt_firewall::Severity::Critical);
}

#[test]
fn test_classify_verdict_safe() {
    let classifier = LocalClassifier::new();
    let (verdict, severity, _) = classifier.classify_verdict(0.2);
    assert_eq!(verdict, prompt_firewall::Verdict::Safe);
    assert_eq!(severity, prompt_firewall::Severity::None);
}

#[test]
fn test_empty_phases() {
    let classifier = LocalClassifier::new();
    let result = classifier.classify(&[]);
    assert_eq!(result.verdict, Verdict::Safe);
    assert_eq!(result.probability, 0.0);
}
