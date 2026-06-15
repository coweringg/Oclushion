use qa_automation::sidecar_manager::SidecarManager;
use qa_automation::{IpcMessage, QaError};
use std::path::PathBuf;
use uuid::Uuid;

#[test]
fn test_sidecar_manager_new_not_running() {
    let mgr = SidecarManager::new(
        PathBuf::from("sidecar/dist/index.js"),
        PathBuf::from("/tmp/qa-test"),
    );
    assert!(!mgr.is_running());
    assert!(mgr.pid().is_none());
}

#[test]
fn test_browser_path_returns_expected() {
    let path = SidecarManager::browser_path();
    let path_str = path.to_string_lossy();
    assert!(path_str.contains(".oclushion"));
    assert!(path_str.contains("browser"));
}

#[test]
fn test_sidecar_start_nonexistent_binary() {
    let mgr = SidecarManager::new(
        PathBuf::from("/nonexistent/sidecar.js"),
        PathBuf::from("/tmp/qa-test"),
    );
    let result = mgr.start();
    assert!(result.is_err());
    match result {
        Err(QaError::SidecarCrashed(_)) => {}
        _ => panic!("Expected SidecarCrashed error"),
    }
}

#[test]
fn test_get_status_when_not_started() {
    let mgr = SidecarManager::new(
        PathBuf::from("sidecar/dist/index.js"),
        PathBuf::from("/tmp/qa-test"),
    );
    let status = mgr.get_status();
    assert_eq!(status.pid, 0);
    assert!(!status.is_healthy);
    assert_eq!(status.active_tests, 0);
}

#[test]
fn test_double_stop_is_safe() {
    let mgr = SidecarManager::new(
        PathBuf::from("sidecar/dist/index.js"),
        PathBuf::from("/tmp/qa-test"),
    );
    assert!(mgr.stop().is_ok());
    assert!(mgr.stop().is_ok());
}

#[test]
fn test_send_message_fails_when_not_started() {
    let mgr = SidecarManager::new(
        PathBuf::from("sidecar/dist/index.js"),
        PathBuf::from("/tmp/qa-test"),
    );
    let msg = IpcMessage {
        id: Uuid::new_v4(),
        method: "ping".into(),
        params: serde_json::json!({}),
    };
    let result = mgr.send_message(msg);
    assert!(result.is_err());
}
