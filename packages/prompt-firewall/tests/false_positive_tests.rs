use prompt_firewall::pipeline::orchestrator::Orchestrator;
use prompt_firewall::patterns::all_patterns;
use prompt_firewall::pipeline::pattern_matcher::PatternMatcher;
use prompt_firewall::Verdict;

fn build_orchestrator() -> Orchestrator {
    let patterns = all_patterns();
    let matcher = PatternMatcher::new(&patterns).expect("Failed to build matcher");
    Orchestrator::new(matcher)
}

#[test]
fn test_benign_code_no_false_positive() {
    let content = std::fs::read_to_string("tests/fixtures/benign_code.ts")
        .expect("Failed to read fixture");
    let orch = build_orchestrator();
    let result = orch.analyze(&content, "benign_code.ts");
    assert_eq!(result.verdict, Verdict::Safe, "Benign code should be safe: {:?}", result.details);
}

#[test]
fn test_injection_in_comments_detected() {
    let content = std::fs::read_to_string("tests/fixtures/injection_in_comments.ts")
        .expect("Failed to read fixture");
    let orch = build_orchestrator();
    let result = orch.analyze(&content, "injection_in_comments.ts");
    assert_ne!(result.verdict, Verdict::Safe, "Should detect injection in comments");
}

#[test]
fn test_unicode_attack_detected() {
    let content = std::fs::read_to_string("tests/fixtures/unicode_attack.ts")
        .expect("Failed to read fixture");
    let orch = build_orchestrator();
    let result = orch.analyze(&content, "unicode_attack.ts");
    assert_ne!(result.verdict, Verdict::Safe, "Should detect unicode attack");
}

#[test]
fn test_base64_payload_detected() {
    let content = std::fs::read_to_string("tests/fixtures/base64_payload.ts")
        .expect("Failed to read fixture");
    let orch = build_orchestrator();
    let result = orch.analyze(&content, "base64_payload.ts");
    assert_ne!(result.verdict, Verdict::Safe, "Should detect base64 payload");
}

#[test]
fn test_indirect_injection_detected() {
    let content = std::fs::read_to_string("tests/fixtures/indirect_injection.md")
        .expect("Failed to read fixture");
    let orch = build_orchestrator();
    let result = orch.analyze(&content, "indirect_injection.md");
    assert_ne!(result.verdict, Verdict::Safe, "Should detect indirect injection");
}

#[test]
fn test_error_types_exist() {
    let _: prompt_firewall::ScanError;
    let _: prompt_firewall::QuarantineError;
    let _: prompt_firewall::AuditError;
    let _: prompt_firewall::PatternError;
    let _: prompt_firewall::FirewallError;
}

#[test]
fn test_quarantine_workflow() {
    use prompt_firewall::quarantine::manager::Manager;
    let mut manager = Manager::new();
    let entry = manager.quarantine("test.rs", "Injection detected", "High");
    assert!(entry.is_ok());
    assert_eq!(manager.active_count(), 1);
    assert!(manager.is_quarantined("test.rs"));

    let released = manager.release("test.rs");
    assert!(released.is_ok());
    assert_eq!(manager.active_count(), 0);
}

#[test]
fn test_allowlist() {
    use prompt_firewall::quarantine::allowlist::Allowlist;
    let mut allowlist = Allowlist::new();
    allowlist.add("/safe/dir");
    assert!(allowlist.contains("/safe/dir"));
    assert!(allowlist.is_allowed("/safe/dir/file.rs"));
    assert!(!allowlist.is_allowed("/unsafe/file.rs"));
    allowlist.remove("/safe/dir");
    assert!(!allowlist.contains("/safe/dir"));
}

#[test]
fn test_audit_log() {
    use prompt_firewall::audit::logger::Logger;
    let mut logger = Logger::new();
    logger.log_scan("test.rs", "tester");
    logger.log_quarantine("test.rs", "tester", "Injection");
    assert_eq!(logger.entries().len(), 2);
    let modify_result = logger.try_modify();
    assert!(modify_result.is_err());
}

#[test]
fn test_pattern_updater_hash() {
    use prompt_firewall::patterns::updater::Updater;
    let data = b"test data";
    let hash = Updater::compute_hash(data);
    assert!(Updater::verify_signature(data, &hash));
    assert!(!Updater::verify_signature(data, "badhash"));
}
