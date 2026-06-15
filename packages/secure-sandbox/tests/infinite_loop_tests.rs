use secure_sandbox::engine::SandboxEngine;
use secure_sandbox::{EngineConfig, ExecutionRequest, SandboxErrorKind};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

fn test_engine() -> SandboxEngine {
    let config = EngineConfig {
        cache_dir: PathBuf::from("target/test_cache"),
        runtimes_dir: PathBuf::from("target/test_runtimes"),
        temp_dir: PathBuf::from("target/test_sandbox"),
        project_dir: PathBuf::from("."),
        allow_network: false,
        ..Default::default()
    };
    SandboxEngine::new(config).unwrap()
}

fn infinite_loop_wasm() -> Vec<u8> {
    wat::parse_str(r#"(module
        (export "_start" (func $start))
        (func $start
            (loop $loop
                br $loop
            )
        )
    )"#).unwrap()
}

fn finite_loop_wasm() -> Vec<u8> {
    wat::parse_str(r#"(module
        (export "_start" (func $start))
        (func $start
            (local $i i32)
            i32.const 100
            local.set $i
            (loop $loop
                local.get $i
                i32.const 1
                i32.sub
                local.tee $i
                br_if $loop
            )
        )
    )"#).unwrap()
}

fn trivial_wasm() -> Vec<u8> {
    wat::parse_str(r#"(module
        (export "_start" (func $start))
        (func $start)
    )"#).unwrap()
}

fn make_request(fuel: u64, memory_mb: u32) -> ExecutionRequest {
    ExecutionRequest {
        id: Uuid::new_v4(),
        language: secure_sandbox::Language::Rust,
        code: String::new(),
        files_needed: Vec::new(),
        args: Vec::new(),
        env_vars: HashMap::new(),
        memory_mb,
        fuel_amount: fuel,
        timeout_ms: 10_000,
    }
}

#[test]
fn test_trivial_execution_succeeds() {
    let engine = test_engine();
    let wasm = trivial_wasm();
    let request = make_request(1_000_000, 128);
    let result = engine.execute_wasm(&wasm, &request);
    assert!(result.success, "trivial execution should succeed: {:?}", result.error);
}

#[test]
fn test_finite_loop_succeeds() {
    let engine = test_engine();
    let wasm = finite_loop_wasm();
    let request = make_request(1_000_000, 128);
    let result = engine.execute_wasm(&wasm, &request);
    assert!(result.success, "finite loop should complete: {:?}", result.error);
    assert!(result.fuel_consumed > 0, "fuel should be consumed");
}

#[test]
#[ignore = "wasmtime 26 on Windows: out_of_gas uses longjmp which crashes with STATUS_STACK_BUFFER_OVERRUN"]
fn test_infinite_loop_fuel_exhaustion() {
    let engine = test_engine();
    let wasm = infinite_loop_wasm();
    let request = make_request(1000, 128);
    let result = engine.execute_wasm(&wasm, &request);
    assert!(!result.success, "expected infinite loop to fail");
    if let Some(ref err) = result.error {
        assert_eq!(
            err.kind,
            SandboxErrorKind::FuelExhausted,
            "expected fuel exhaustion but got: {:?}: {}",
            err.kind,
            err.message
        );
    }
    assert!(result.fuel_consumed > 0, "expected some fuel to be consumed");
}
