use crate::cache::WasmCache;
use crate::engine::SandboxEngine;
use crate::executor::Executor;
use crate::{EngineConfig, ExecutionRequest, ExecutionResult, Language};
use std::sync::Arc;
use uuid::Uuid;

pub struct TauriCommands {
    engine: Arc<SandboxEngine>,
    executor: Arc<Executor>,
    cache: Arc<WasmCache>,
}

impl TauriCommands {
    pub fn new() -> std::result::Result<Self, String> {
        let config = EngineConfig::default();
        let engine = Arc::new(
            SandboxEngine::new(config).map_err(|e| e.to_string())?,
        );
        let cache_dir = engine.config().cache_dir.clone();
        let cache = Arc::new(WasmCache::new(cache_dir));
        let executor = Arc::new(Executor::new(engine.clone(), cache.clone()));
        Ok(TauriCommands {
            engine,
            executor,
            cache,
        })
    }

    pub fn with_parts(
        engine: Arc<SandboxEngine>,
        executor: Arc<Executor>,
        cache: Arc<WasmCache>,
    ) -> Self {
        TauriCommands {
            engine,
            executor,
            cache,
        }
    }

    pub fn sandbox_execute(&self, request_json: String) -> std::result::Result<String, String> {
        let request: ExecutionRequest = serde_json::from_str(&request_json)
            .map_err(|e| format!("failed to parse request: {}", e))?;

        let result = self.executor.run(&self.engine, request);
        serde_json::to_string(&result).map_err(|e| format!("failed to serialize result: {}", e))
    }

    pub fn sandbox_execute_batch(
        &self,
        requests_json: String,
    ) -> std::result::Result<String, String> {
        let requests: Vec<ExecutionRequest> = serde_json::from_str(&requests_json)
            .map_err(|e| format!("failed to parse batch: {}", e))?;

        let results = self.executor.run_batch(requests);
        serde_json::to_string(&results).map_err(|e| format!("failed to serialize results: {}", e))
    }

    pub fn sandbox_cancel(&self, execution_id: String) -> std::result::Result<(), String> {
        let id =
            Uuid::parse_str(&execution_id).map_err(|e| format!("invalid execution id: {}", e))?;
        self.executor.cancel(id).map_err(|e| e.to_string())
    }

    pub fn sandbox_get_status(&self) -> std::result::Result<String, String> {
        let status = serde_json::json!({
            "config": {
                "default_memory_mb": self.engine.config().default_memory_mb,
                "default_fuel_amount": self.engine.config().default_fuel_amount,
                "default_timeout_ms": self.engine.config().default_timeout_ms,
                "allow_network": self.engine.config().allow_network,
                "cache_dir": self.engine.config().cache_dir.to_string_lossy(),
                "runtimes_dir": self.engine.config().runtimes_dir.to_string_lossy(),
                "temp_dir": self.engine.config().temp_dir.to_string_lossy(),
                "project_dir": self.engine.config().project_dir.to_string_lossy(),
            },
            "active_executions": self.executor.active_count(),
        });
        serde_json::to_string(&status).map_err(|e| format!("serialization error: {}", e))
    }

    pub fn sandbox_clear_cache(&self) -> std::result::Result<(), String> {
        self.cache.clear();
        Ok(())
    }

    pub fn sandbox_get_cache_stats(&self) -> std::result::Result<String, String> {
        let stats = self.cache.stats();
        serde_json::to_string(&stats).map_err(|e| format!("serialization error: {}", e))
    }

    pub fn sandbox_test_memory_limit(&self, mb: u32) -> ExecutionResult {
        let request = ExecutionRequest {
            id: Uuid::new_v4(),
            language: Language::Rust,
            code: format!(
                r#"fn main() {{
    let mut vec = Vec::new();
    loop {{
        vec.push([0u8; 65536]);
    }}
}}"#
            ),
            files_needed: Vec::new(),
            args: Vec::new(),
            env_vars: std::collections::HashMap::new(),
            memory_mb: mb,
            fuel_amount: 1_000_000,
            timeout_ms: 10_000,
        };

        self.executor.run(&self.engine, request)
    }
}
