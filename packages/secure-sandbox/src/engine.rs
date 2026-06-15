use crate::runtimes::get_runtime;
use crate::security::FsJail;
use crate::{EngineConfig, ExecutionRequest, ExecutionResult, Language, Result, SandboxError, SandboxErrorKind};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::Instant;
use wasmtime::{Config, Engine, Linker, Module, ResourceLimiter, Store};
use wasmtime_wasi::preview1::{self, WasiP1Ctx};
use wasmtime_wasi::WasiCtxBuilder;

pub struct SandboxEngine {
    config: EngineConfig,
    engine: Arc<Engine>,
}

impl SandboxEngine {
    pub fn new(config: EngineConfig) -> Result<Self> {
        let mut wasm_config = Config::new();
        wasm_config.consume_fuel(true);
        wasm_config.debug_info(true);
        wasm_config.cranelift_opt_level(wasmtime::OptLevel::Speed);

        let engine = Engine::new(&wasm_config).map_err(|e| SandboxError {
            kind: SandboxErrorKind::RuntimeError,
            message: format!("failed to create wasmtime engine: {}", e),
            backtrace: None,
        })?;

        Ok(SandboxEngine {
            config,
            engine: Arc::new(engine),
        })
    }

    pub fn new_with_wasmtime(config: EngineConfig, engine: wasmtime::Engine) -> Self {
        SandboxEngine {
            config,
            engine: Arc::new(engine),
        }
    }

    pub fn config(&self) -> &EngineConfig {
        &self.config
    }

    pub fn engine(&self) -> &Engine {
        &self.engine
    }

    pub fn execute(&self, request: ExecutionRequest) -> ExecutionResult {
        let start = Instant::now();
        let id = request.id;
        let language = request.language.clone();
        let memory_mb = if request.memory_mb > 0 {
            request.memory_mb
        } else {
            self.config.default_memory_mb
        };
        let fuel_amount = if request.fuel_amount > 0 {
            request.fuel_amount
        } else {
            self.config.default_fuel_amount
        };
        let _timeout_ms = if request.timeout_ms > 0 {
            request.timeout_ms
        } else {
            self.config.default_timeout_ms
        };

        let runtime = match get_runtime(language.clone()) {
            Ok(r) => r,
            Err(e) => return ExecutionResult::with_error(id, e),
        };

        let (module, _wasm_bytes) = match runtime.compile(&request.code, &self.engine) {
            Ok(m) => m,
            Err(e) => return ExecutionResult::with_error(id, e),
        };

        let mut wasi_builder = WasiCtxBuilder::new();
        wasi_builder.inherit_stdout();
        wasi_builder.inherit_stderr();
        wasi_builder.inherit_stdin();
        wasi_builder.env("LANG", "C");

        for (key, val) in &request.env_vars {
            wasi_builder.env(key, val);
        }

        let fs_jail = FsJail::new(
            self.config.project_dir.clone(),
            self.config.temp_dir.clone(),
        );
        fs_jail.configure_wasi(&mut wasi_builder);

        if !self.config.allow_network {
            wasi_builder.env("OCKAM_DISABLE", "true");
        }

        let wasi_ctx: WasiP1Ctx = wasi_builder.build_p1();
        let mut store = Store::new(&self.engine, SandboxState::new(wasi_ctx, memory_mb));

        match store.set_fuel(fuel_amount) {
            Ok(_) => {}
            Err(e) => {
                return ExecutionResult::with_error(id, SandboxError::from(e));
            }
        }

        let mut linker = Linker::new(&self.engine);
        match preview1::add_to_linker_sync(&mut linker, |state: &mut SandboxState| &mut state.wasi) {
            Ok(_) => {}
            Err(e) => {
                return ExecutionResult::with_error(id, SandboxError::from(e));
            }
        }

        let instance = match linker.instantiate(&mut store, &module) {
            Ok(i) => i,
            Err(e) => return ExecutionResult::with_error(id, SandboxError::from(e)),
        };

        if instance.get_export(&mut store, "_start").is_none() {
            return ExecutionResult::with_error(
                id,
                SandboxError {
                    kind: SandboxErrorKind::CompileError,
                    message: "export '_start' not found in compiled module".to_string(),
                    backtrace: None,
                },
            );
        }

        let func = match instance.get_typed_func::<(), ()>(&mut store, "_start") {
            Ok(f) => f,
            Err(e) => return ExecutionResult::with_error(id, SandboxError::from(e)),
        };

        match func.call(&mut store, ()) {
            Ok(_) => {
                let duration = start.elapsed().as_millis() as u64;
                let remaining_fuel = store.get_fuel().unwrap_or(0);
                let fuel_consumed = fuel_amount.saturating_sub(remaining_fuel);
                ExecutionResult {
                    id,
                    success: true,
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: 0,
                    duration_ms: duration,
                    memory_used_mb: fuel_consumed.min(1024) as u64,
                    fuel_consumed,
                    error: None,
                    backtrace: None,
                }
            }
            Err(trap) => {
                let duration = start.elapsed().as_millis() as u64;
                let remaining_fuel = store.get_fuel().unwrap_or(0);
                let fuel_consumed = fuel_amount.saturating_sub(remaining_fuel);
                let mut sandbox_error: SandboxError = trap.into();
                let msg = sandbox_error.message.clone();
                if msg.contains("out of fuel") || msg.contains("fuel") {
                    sandbox_error.kind = SandboxErrorKind::FuelExhausted;
                }
                if msg.contains("memory") && (msg.contains("limit") || msg.contains("grow")) {
                    sandbox_error.kind = SandboxErrorKind::MemoryLimitExceeded;
                }
                ExecutionResult {
                    id,
                    success: false,
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: -1,
                    duration_ms: duration,
                    memory_used_mb: 0,
                    fuel_consumed,
                    error: Some(sandbox_error),
                    backtrace: None,
                }
            }
        }
    }

    pub fn execute_sync(&self, request: ExecutionRequest) -> ExecutionResult {
        self.execute(request)
    }

    pub fn execute_wasm(&self, wasm_bytes: &[u8], request: &ExecutionRequest) -> ExecutionResult {
        let start = Instant::now();
        let id = request.id;
        let memory_mb = if request.memory_mb > 0 {
            request.memory_mb
        } else {
            self.config.default_memory_mb
        };
        let fuel_amount = if request.fuel_amount > 0 {
            request.fuel_amount
        } else {
            self.config.default_fuel_amount
        };
        let _timeout_ms = if request.timeout_ms > 0 {
            request.timeout_ms
        } else {
            self.config.default_timeout_ms
        };

        let module = match Module::new(&self.engine, wasm_bytes) {
            Ok(m) => m,
            Err(e) => return ExecutionResult::with_error(id, SandboxError::from(e)),
        };

        let mut wasi_builder = WasiCtxBuilder::new();
        wasi_builder.inherit_stdout();
        wasi_builder.inherit_stderr();
        wasi_builder.inherit_stdin();
        wasi_builder.env("LANG", "C");

        for (key, val) in &request.env_vars {
            wasi_builder.env(key, val);
        }

        let fs_jail = FsJail::new(
            self.config.project_dir.clone(),
            self.config.temp_dir.clone(),
        );
        fs_jail.configure_wasi(&mut wasi_builder);

        if !self.config.allow_network {
            wasi_builder.env("OCKAM_DISABLE", "true");
        }

        let wasi_ctx: WasiP1Ctx = wasi_builder.build_p1();
        let mut store = Store::new(&self.engine, SandboxState::new(wasi_ctx, memory_mb));

        match store.set_fuel(fuel_amount) {
            Ok(_) => {}
            Err(e) => {
                return ExecutionResult::with_error(id, SandboxError::from(e));
            }
        }

        let mut linker = Linker::new(&self.engine);
        match preview1::add_to_linker_sync(&mut linker, |state: &mut SandboxState| &mut state.wasi) {
            Ok(_) => {}
            Err(e) => {
                return ExecutionResult::with_error(id, SandboxError::from(e));
            }
        }

        let instance = match linker.instantiate(&mut store, &module) {
            Ok(i) => i,
            Err(e) => return ExecutionResult::with_error(id, SandboxError::from(e)),
        };

        let func = match instance.get_typed_func::<(), ()>(&mut store, "_start") {
            Ok(f) => f,
            Err(_) => return ExecutionResult::with_error(id, SandboxError {
                kind: SandboxErrorKind::CompileError,
                message: "export '_start' not found".to_string(),
                backtrace: None,
            }),
        };

        match func.call(&mut store, ()) {
            Ok(_) => {
                let duration = start.elapsed().as_millis() as u64;
                let remaining_fuel = store.get_fuel().unwrap_or(0);
                let fuel_consumed = fuel_amount.saturating_sub(remaining_fuel);
                ExecutionResult {
                    id,
                    success: true,
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: 0,
                    duration_ms: duration,
                    memory_used_mb: fuel_consumed.min(1024) as u64,
                    fuel_consumed,
                    error: None,
                    backtrace: None,
                }
            }
            Err(trap) => {
                let duration = start.elapsed().as_millis() as u64;
                let remaining_fuel = store.get_fuel().unwrap_or(0);
                let fuel_consumed = fuel_amount.saturating_sub(remaining_fuel);
                let mut sandbox_error: SandboxError = trap.into();
                let msg = sandbox_error.message.clone();
                if msg.contains("out of fuel") || msg.contains("fuel") {
                    sandbox_error.kind = SandboxErrorKind::FuelExhausted;
                }
                if msg.contains("memory") && (msg.contains("limit") || msg.contains("grow")) {
                    sandbox_error.kind = SandboxErrorKind::MemoryLimitExceeded;
                }
                ExecutionResult {
                    id,
                    success: false,
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: -1,
                    duration_ms: duration,
                    memory_used_mb: 0,
                    fuel_consumed,
                    error: Some(sandbox_error),
                    backtrace: None,
                }
            }
        }
    }

    pub fn compile_module(&self, wasm_bytes: &[u8]) -> Result<Module> {
        Module::new(&self.engine, wasm_bytes).map_err(|e| SandboxError {
            kind: SandboxErrorKind::CompileError,
            message: format!("AOT compilation failed: {}", e),
            backtrace: None,
        })
    }

    pub fn hash_code(code: &str, language: &Language) -> String {
        let mut hasher = Sha256::new();
        hasher.update(language.as_str());
        hasher.update(code.as_bytes());
        hex::encode(hasher.finalize())
    }
}

pub struct SandboxState {
    pub wasi: WasiP1Ctx,
    max_memory_bytes: u64,
}

impl SandboxState {
    pub fn new(wasi: WasiP1Ctx, max_memory_mb: u32) -> Self {
        SandboxState {
            wasi,
            max_memory_bytes: (max_memory_mb as u64) * 1024 * 1024,
        }
    }
}

impl ResourceLimiter for SandboxState {
    fn memory_growing(&mut self, _current: usize, _desired: usize, _maximum: Option<usize>) -> std::result::Result<bool, anyhow::Error> {
        if let Some(max) = _maximum {
            if _desired > max {
                return Err(anyhow::anyhow!(
                    "memory limit of {} MB exceeded (requested {} MB)",
                    self.max_memory_bytes / (1024 * 1024),
                    _desired / (1024 * 1024)
                ));
            }
        }
        if (_desired as u64) > self.max_memory_bytes {
            Err(anyhow::anyhow!(
                "memory limit of {} MB exceeded (requested {} MB)",
                self.max_memory_bytes / (1024 * 1024),
                _desired / (1024 * 1024)
            ))
        } else {
            Ok(true)
        }
    }

    fn memory_grow_failed(&mut self, error: anyhow::Error) -> std::result::Result<(), anyhow::Error> {
        Err(error)
    }

    fn table_growing(&mut self, _current: usize, _desired: usize, _maximum: Option<usize>) -> std::result::Result<bool, anyhow::Error> {
        if let Some(max) = _maximum {
            if _desired > max {
                return Err(anyhow::anyhow!("table limit exceeded"));
            }
        }
        Ok(true)
    }

    fn table_grow_failed(&mut self, error: anyhow::Error) -> std::result::Result<(), anyhow::Error> {
        Err(error)
    }
}
