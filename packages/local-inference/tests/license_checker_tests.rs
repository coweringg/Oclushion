use local_inference::models::license_checker::LicenseChecker;

#[test]
fn test_apache_license_is_commercial_safe() {
    let checker = LicenseChecker;
    let result = checker.is_commercial_safe("Apache-2.0");
    assert!(result.unwrap());
}

#[test]
fn test_mit_license_is_commercial_safe() {
    let checker = LicenseChecker;
    let result = checker.is_commercial_safe("MIT");
    assert!(result.unwrap());
}

#[test]
fn test_cc_by_nc_is_not_commercial_safe() {
    let checker = LicenseChecker;
    let result = checker.is_commercial_safe("CC-BY-NC-4.0");
    assert!(!result.unwrap());
}

#[test]
fn test_non_commercial_is_not_commercial_safe() {
    let checker = LicenseChecker;
    let result = checker.is_commercial_safe("Non-Commercial License");
    assert!(!result.unwrap());
}

#[test]
fn test_blocked_license_case_insensitive() {
    let checker = LicenseChecker;
    let result = checker.is_commercial_safe("cc-by-nc-sa-4.0");
    assert!(!result.unwrap());
}

#[test]
fn test_apache_has_no_restrictions() {
    let checker = LicenseChecker;
    let restrictions = checker.has_restrictions("Apache-2.0");
    assert!(restrictions.is_empty());
}

#[test]
fn test_llama_has_restrictions() {
    let checker = LicenseChecker;
    let restrictions = checker.has_restrictions("Llama-3.2");
    assert!(!restrictions.is_empty());
    assert!(restrictions.iter().any(|r| r.contains("attribution")));
}

#[test]
fn test_unknown_license_has_no_restrictions() {
    let checker = LicenseChecker;
    let restrictions = checker.has_restrictions("Unknown-License-v1");
    assert!(restrictions.is_empty());
}

#[test]
fn test_gemma_has_restrictions() {
    let checker = LicenseChecker;
    let restrictions = checker.has_restrictions("Gemma");
    assert!(!restrictions.is_empty());
}
