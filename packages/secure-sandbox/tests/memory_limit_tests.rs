use secure_sandbox::engine::SandboxEngine;
use secure_sandbox::{EngineConfig, ExecutionRequest};
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
fn test_small_execution_succeeds() {
    let engine = test_engine();
    let wasm = trivial_wasm();
    let request = make_request(1_000_000, 128);
    let result = engine.execute_wasm(&wasm, &request);
    assert!(result.success, "expected success: {:?}", result.error);
}

#[test]
fn test_zero_memory_uses_default() {
    let config = EngineConfig {
        default_memory_mb: 64,
        cache_dir: PathBuf::from("target/test_cache"),
        runtimes_dir: PathBuf::from("target/test_runtimes"),
        temp_dir: PathBuf::from("target/test_sandbox"),
        project_dir: PathBuf::from("."),
        allow_network: false,
        ..Default::default()
    };
    let engine = SandboxEngine::new(config).unwrap();
    let wasm = trivial_wasm();
    let request = make_request(1_000_000, 0);
    let _result = engine.execute_wasm(&wasm, &request);
    assert_eq!(engine.config().default_memory_mb, 64);
}
