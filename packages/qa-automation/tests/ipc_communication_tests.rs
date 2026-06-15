use qa_automation::{
    EvidenceFile, EvidenceKind, IpcMessage, IpcResponse, SidecarStatus, StepAction, TestResult,
    TestSpec, TestStep, TestTimestamps, Viewport,
};
use uuid::Uuid;

#[test]
fn test_ipc_message_serialization() {
    let msg = IpcMessage {
        id: Uuid::nil(),
        method: "ping".into(),
        params: serde_json::json!({}),
    };
    let json = serde_json::to_string(&msg).unwrap();
    assert!(json.contains("\"method\":\"ping\""));
    assert!(json.contains("\"id\":\"00000000-0000-0000-0000-000000000000\""));

    let deserialized: IpcMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.method, "ping");
    assert_eq!(deserialized.id, Uuid::nil());
}

#[test]
fn test_ipc_response_serialization() {
    let resp = IpcResponse {
        id: Uuid::nil(),
        result: Some(serde_json::json!({ "pong": true })),
        error: None,
    };
    let json = serde_json::to_string(&resp).unwrap();
    assert!(json.contains("\"pong\":true"));

    let deserialized: IpcResponse = serde_json::from_str(&json).unwrap();
    assert!(deserialized.result.is_some());
    assert!(deserialized.error.is_none());
}

#[test]
fn test_ipc_response_with_error() {
    let resp = IpcResponse {
        id: Uuid::nil(),
        result: None,
        error: Some("Something went wrong".into()),
    };
    let json = serde_json::to_string(&resp).unwrap();
    assert!(json.contains("Something went wrong"));

    let deserialized: IpcResponse = serde_json::from_str(&json).unwrap();
    assert!(deserialized.result.is_none());
    assert_eq!(deserialized.error.unwrap(), "Something went wrong");
}

#[test]
fn test_test_spec_full_roundtrip() {
    let spec = TestSpec {
        id: Uuid::new_v4(),
        description: "Login test".into(),
        url: "http://localhost:3000/login".into(),
        steps: vec![
            TestStep {
                action: StepAction::Navigate,
                selector_hint: None,
                value: None,
                wait_ms: None,
            },
            TestStep {
                action: StepAction::Type,
                selector_hint: Some("#username".into()),
                value: Some("admin".into()),
                wait_ms: None,
            },
            TestStep {
                action: StepAction::Type,
                selector_hint: Some("#password".into()),
                value: Some("secret".into()),
                wait_ms: None,
            },
            TestStep {
                action: StepAction::Click,
                selector_hint: Some("#login-btn".into()),
                value: None,
                wait_ms: Some(2000),
            },
        ],
        timeout_ms: 30000,
        viewports: vec![Viewport::desktop()],
    };

    let json = serde_json::to_string_pretty(&spec).unwrap();
    let deserialized: TestSpec = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.description, "Login test");
    assert_eq!(deserialized.steps.len(), 4);
    assert_eq!(deserialized.viewports.len(), 1);
    assert_eq!(deserialized.timeout_ms, 30000);
}

#[test]
fn test_test_result_roundtrip() {
    let result = TestResult {
        spec_id: Uuid::new_v4(),
        passed: true,
        steps_passed: 5,
        steps_failed: 0,
        evidence: vec![
            EvidenceFile {
                path: "/tmp/qa/test123/screenshot.png".into(),
                kind: EvidenceKind::Screenshot,
                size_bytes: 1024,
            },
            EvidenceFile {
                path: "/tmp/qa/test123/console_log.txt".into(),
                kind: EvidenceKind::ConsoleLog,
                size_bytes: 512,
            },
        ],
        duration_ms: 1234,
        failure_reason: None,
        timestamps: TestTimestamps {
            started_at: "2026-01-01T00:00:00Z".into(),
            completed_at: "2026-01-01T00:00:02Z".into(),
        },
    };

    let json = serde_json::to_string_pretty(&result).unwrap();
    let deserialized: TestResult = serde_json::from_str(&json).unwrap();

    assert!(deserialized.passed);
    assert_eq!(deserialized.steps_passed, 5);
    assert_eq!(deserialized.steps_failed, 0);
    assert_eq!(deserialized.evidence.len(), 2);
    assert_eq!(deserialized.duration_ms, 1234);
}

#[test]
fn test_sidecar_status_serialization() {
    let status = SidecarStatus {
        pid: 12345,
        uptime_secs: 3600,
        is_healthy: true,
        active_tests: 2,
        browser_ready: true,
    };

    let json = serde_json::to_string(&status).unwrap();
    let deserialized: SidecarStatus = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.pid, 12345);
    assert_eq!(deserialized.uptime_secs, 3600);
    assert!(deserialized.is_healthy);
    assert_eq!(deserialized.active_tests, 2);
}

#[test]
fn test_viewport_defaults() {
    let desktop = Viewport::desktop();
    assert_eq!(desktop.width, 1920);
    assert_eq!(desktop.height, 1080);
    assert_eq!(desktop.label, "Desktop");

    let tablet = Viewport::tablet();
    assert_eq!(tablet.width, 768);
    assert_eq!(tablet.height, 1024);

    let mobile = Viewport::mobile();
    assert_eq!(mobile.width, 375);
    assert_eq!(mobile.height, 812);

    let all = Viewport::all();
    assert_eq!(all.len(), 3);
}

#[test]
fn test_step_action_serialization() {
    let actions = vec![
        StepAction::Navigate,
        StepAction::Click,
        StepAction::Type,
        StepAction::Select,
        StepAction::AssertVisible,
        StepAction::AssertText,
        StepAction::AssertScreenshot,
        StepAction::Wait,
        StepAction::Extract,
    ];

    for action in &actions {
        let json = serde_json::to_string(action).unwrap();
        let deserialized: StepAction = serde_json::from_str(&json).unwrap();
        assert_eq!(format!("{action:?}"), format!("{deserialized:?}"));
    }
}

#[test]
fn test_evidence_kind_display() {
    assert_eq!(EvidenceKind::Screenshot.to_string(), "screenshot");
    assert_eq!(EvidenceKind::Trace.to_string(), "trace");
    assert_eq!(EvidenceKind::Video.to_string(), "video");
    assert_eq!(EvidenceKind::ConsoleLog.to_string(), "console_log");
    assert_eq!(EvidenceKind::DomSnapshot.to_string(), "dom_snapshot");
}

#[test]
fn test_test_step_roundtrip() {
    let step = TestStep {
        action: StepAction::Type,
        selector_hint: Some("#email".into()),
        value: Some("test@example.com".into()),
        wait_ms: Some(500),
    };

    let json = serde_json::to_string(&step).unwrap();
    let deserialized: TestStep = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.value.unwrap(), "test@example.com");
    assert_eq!(deserialized.selector_hint.unwrap(), "#email");
    assert_eq!(deserialized.wait_ms.unwrap(), 500);
}

#[test]
fn test_evidence_file_kind_mapping() {
    let evidence = EvidenceFile {
        path: "evidence/screenshot.png".into(),
        kind: EvidenceKind::Screenshot,
        size_bytes: 2048,
    };

    let json = serde_json::to_string(&evidence).unwrap();
    let deserialized: EvidenceFile = serde_json::from_str(&json).unwrap();

    assert!(matches!(deserialized.kind, EvidenceKind::Screenshot));
    assert_eq!(deserialized.size_bytes, 2048);
}

#[test]
fn test_test_timestamps_roundtrip() {
    let ts = TestTimestamps {
        started_at: "2026-06-14T10:00:00+00:00".into(),
        completed_at: "2026-06-14T10:01:00+00:00".into(),
    };

    let json = serde_json::to_string(&ts).unwrap();
    let deserialized: TestTimestamps = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.started_at, "2026-06-14T10:00:00+00:00");
    assert_eq!(deserialized.completed_at, "2026-06-14T10:01:00+00:00");
}
