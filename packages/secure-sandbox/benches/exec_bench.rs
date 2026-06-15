use criterion::{criterion_group, criterion_main, Criterion};
use secure_sandbox::engine::SandboxEngine;
use secure_sandbox::{EngineConfig, ExecutionRequest, Language};
use std::path::PathBuf;
use uuid::Uuid;

fn bench_execution(c: &mut Criterion) {
    let config = EngineConfig {
        cache_dir: PathBuf::from("target/bench_cache"),
        runtimes_dir: PathBuf::from("target/bench_runtimes"),
        temp_dir: PathBuf::from("target/bench_sandbox"),
        project_dir: PathBuf::from("."),
        allow_network: false,
        ..Default::default()
    };
    let engine = SandboxEngine::new(config).unwrap();

    c.bench_function("execute_sync_trivial", |b| {
        b.iter(|| {
            let req = ExecutionRequest {
                id: Uuid::new_v4(),
                language: Language::Rust,
                code: "fn main() { let x = 42; }".to_string(),
                files_needed: Vec::new(),
                args: Vec::new(),
                env_vars: std::collections::HashMap::new(),
                memory_mb: 128,
                fuel_amount: 1_000_000,
                timeout_ms: 10_000,
            };
            let _ = engine.execute_sync(req);
        })
    });

    c.bench_function("execute_sync_with_loop", |b| {
        b.iter(|| {
            let req = ExecutionRequest {
                id: Uuid::new_v4(),
                language: Language::Rust,
                code: "fn main() { let mut s = 0u64; for i in 0..1000 { s += i; } }"
                    .to_string(),
                files_needed: Vec::new(),
                args: Vec::new(),
                env_vars: std::collections::HashMap::new(),
                memory_mb: 128,
                fuel_amount: 1_000_000,
                timeout_ms: 10_000,
            };
            let _ = engine.execute_sync(req);
        })
    });
}

criterion_group!(benches, bench_execution);
criterion_main!(benches);
