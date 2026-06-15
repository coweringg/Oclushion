use secure_sandbox::security::NetworkGuard;

#[test]
fn test_network_blocked_by_default() {
    let guard = NetworkGuard::new(false, Vec::new());
    assert!(!guard.is_allowed("127.0.0.1:8080"), "network should be blocked by default");
}

#[test]
fn test_network_allowed_when_configured() {
    let guard = NetworkGuard::new(true, Vec::new());
    assert!(guard.is_allowed("example.com"), "network should be allowed");
}

#[test]
fn test_add_allowed_host() {
    let mut guard = NetworkGuard::new(false, Vec::new());
    guard.add_allowed_host("api.example.com");
    guard.set_allow_network(true);
    assert!(guard.is_allowed("api.example.com"), "host should be allowed");
}

#[test]
fn test_set_allow_network() {
    let mut guard = NetworkGuard::new(true, Vec::new());
    assert!(guard.is_allowed("any-host"));
    guard.set_allow_network(false);
    assert!(!guard.is_allowed("any-host"));
}
