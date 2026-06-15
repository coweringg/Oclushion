use crate::cache::WasmCache;
use crate::engine::SandboxEngine;
use crate::{ExecutionRequest, ExecutionResult, Result, SandboxError, SandboxErrorKind};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        CancellationToken {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

pub struct Executor {
    engine: Arc<SandboxEngine>,
    _cache: Arc<WasmCache>,
    active_executions: Mutex<HashMap<Uuid, CancellationToken>>,
}

impl Executor {
    pub fn new(engine: Arc<SandboxEngine>, cache: Arc<WasmCache>) -> Self {
        Executor {
            engine,
            _cache: cache,
            active_executions: Mutex::new(HashMap::new()),
        }
    }

    pub fn run(&self, engine: &SandboxEngine, request: ExecutionRequest) -> ExecutionResult {
        let id = request.id;
        let token = CancellationToken::new();
        {
            let mut active = self.active_executions.lock().unwrap();
            active.insert(id, token.clone());
        }

        if token.is_cancelled() {
            let mut result = ExecutionResult::new(id);
            result.success = false;
            result.error = Some(SandboxError {
                kind: SandboxErrorKind::RuntimeError,
                message: "execution cancelled before start".to_string(),
                backtrace: None,
            });
            return result;
        }

        let result = engine.execute(request);

        {
            let mut active = self.active_executions.lock().unwrap();
            active.remove(&id);
        }

        result
    }

    pub fn run_batch(&self, requests: Vec<ExecutionRequest>) -> Vec<ExecutionResult> {
        let mut results = Vec::with_capacity(requests.len());
        for req in requests {
            let result = self.run(&self.engine, req);
            results.push(result);
        }
        results
    }

    pub fn cancel(&self, execution_id: Uuid) -> Result<()> {
        let mut active = self.active_executions.lock().unwrap();
        if let Some(token) = active.get(&execution_id) {
            token.cancel();
            active.remove(&execution_id);
            Ok(())
        } else {
            Err(SandboxError {
                kind: SandboxErrorKind::RuntimeError,
                message: format!("execution {} not found or already completed", execution_id),
                backtrace: None,
            })
        }
    }

    pub fn active_count(&self) -> usize {
        let active = self.active_executions.lock().unwrap();
        active.len()
    }
}
