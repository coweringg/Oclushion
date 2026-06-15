use criterion::{black_box, criterion_group, criterion_main, Criterion};
use qa_automation::{
    IpcMessage, IpcResponse, StepAction, TestResult, TestSpec, TestStep, TestTimestamps,
    Viewport,
};
use uuid::Uuid;

fn bench_serialize_ipc_message(c: &mut Criterion) {
    let msg = IpcMessage {
        id: Uuid::new_v4(),
        method: "run_test".into(),
        params: serde_json::json!({
            "url": "http://localhost:3000",
            "viewport": { "width": 1920, "height": 1080 }
        }),
    };

    c.bench_function("serialize_ipc_message", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&msg)).unwrap();
            black_box(json)
        })
    });
}

fn bench_deserialize_ipc_message(c: &mut Criterion) {
    let json = r#"{"id":"550e8400-e29b-41d4-a716-446655440000","method":"run_test","params":{"url":"http://localhost:3000","viewport":{"width":1920,"height":1080}}}"#;

    c.bench_function("deserialize_ipc_message", |b| {
        b.iter(|| {
            let msg: IpcMessage = serde_json::from_str(black_box(json)).unwrap();
            black_box(msg)
        })
    });
}

fn bench_serialize_test_spec(c: &mut Criterion) {
    let spec = TestSpec {
        id: Uuid::new_v4(),
        description: "Login flow test with multiple steps".into(),
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
                value: Some("secret123".into()),
                wait_ms: None,
            },
            TestStep {
                action: StepAction::Click,
                selector_hint: Some("#login-btn".into()),
                value: None,
                wait_ms: Some(2000),
            },
            TestStep {
                action: StepAction::AssertText,
                selector_hint: Some(".dashboard-title".into()),
                value: Some("Welcome".into()),
                wait_ms: None,
            },
        ],
        timeout_ms: 30000,
        viewports: Viewport::all(),
    };

    c.bench_function("serialize_test_spec", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&spec)).unwrap();
            black_box(json)
        })
    });
}

fn bench_deserialize_test_spec(c: &mut Criterion) {
    let spec = TestSpec {
        id: Uuid::new_v4(),
        description: "Login flow test with multiple steps".into(),
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
                value: Some("secret123".into()),
                wait_ms: None,
            },
            TestStep {
                action: StepAction::Click,
                selector_hint: Some("#login-btn".into()),
                value: None,
                wait_ms: Some(2000),
            },
            TestStep {
                action: StepAction::AssertText,
                selector_hint: Some(".dashboard-title".into()),
                value: Some("Welcome".into()),
                wait_ms: None,
            },
        ],
        timeout_ms: 30000,
        viewports: Viewport::all(),
    };
    let json = serde_json::to_string(&spec).unwrap();

    c.bench_function("deserialize_test_spec", |b| {
        b.iter(|| {
            let spec: TestSpec = serde_json::from_str(black_box(&json)).unwrap();
            black_box(spec)
        })
    });
}

fn bench_serialize_test_result(c: &mut Criterion) {
    let result = TestResult {
        spec_id: Uuid::new_v4(),
        passed: true,
        steps_passed: 5,
        steps_failed: 0,
        evidence: vec![],
        duration_ms: 1234,
        failure_reason: None,
        timestamps: TestTimestamps {
            started_at: "2026-01-01T00:00:00Z".into(),
            completed_at: "2026-01-01T00:00:02Z".into(),
        },
    };

    c.bench_function("serialize_test_result", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&result)).unwrap();
            black_box(json)
        })
    });
}

fn bench_ipc_response_roundtrip(c: &mut Criterion) {
    let resp = IpcResponse {
        id: Uuid::new_v4(),
        result: Some(serde_json::json!({
            "passed": true,
            "steps_passed": 5,
            "steps_failed": 0,
            "duration_ms": 1234
        })),
        error: None,
    };

    c.bench_function("ipc_response_roundtrip", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&resp)).unwrap();
            let deserialized: IpcResponse = serde_json::from_str(&json).unwrap();
            black_box(deserialized)
        })
    });
}

criterion_group!(
    benches,
    bench_serialize_ipc_message,
    bench_deserialize_ipc_message,
    bench_serialize_test_spec,
    bench_deserialize_test_spec,
    bench_serialize_test_result,
    bench_ipc_response_roundtrip,
);
criterion_main!(benches);
