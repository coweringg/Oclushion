pub mod engine;
pub mod executor;
pub mod cache;
pub mod bridge;
pub mod runtimes;
pub mod security;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxError {
    pub kind: SandboxErrorKind,
    pub message: String,
    pub backtrace: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SandboxErrorKind {
    CompileError,
    RuntimeError,
    Trap(String),
    MemoryLimitExceeded,
    Timeout,
    FuelExhausted,
    NetworkBlocked,
    FsAccessDenied,
    LanguageNotSupported,
    ModuleNotFound,
    CacheError,
}

impl std::fmt::Display for SandboxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:?}] {}", self.kind, self.message)
    }
}

impl std::error::Error for SandboxError {}

impl From<wasmtime::Error> for SandboxError {
    fn from(err: wasmtime::Error) -> Self {
        let kind = if let Some(trap) = err.downcast_ref::<wasmtime::Trap>() {
            SandboxErrorKind::Trap(trap.to_string())
        } else {
            SandboxErrorKind::RuntimeError
        };
        SandboxError {
            kind,
            message: err.to_string(),
            backtrace: None,
        }
    }
}

impl From<wasmtime::Trap> for SandboxError {
    fn from(trap: wasmtime::Trap) -> Self {
        SandboxError {
            kind: SandboxErrorKind::Trap(trap.to_string()),
            message: trap.to_string(),
            backtrace: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Language {
    JavaScript,
    Python,
    Rust,
}

impl Language {
    pub fn as_str(&self) -> &'static str {
        match self {
            Language::JavaScript => "javascript",
            Language::Python => "python",
            Language::Rust => "rust",
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Language::JavaScript => "js",
            Language::Python => "py",
            Language::Rust => "rs",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub id: Uuid,
    pub language: Language,
    pub code: String,
    pub files_needed: Vec<String>,
    pub args: Vec<String>,
    pub env_vars: HashMap<String, String>,
    pub memory_mb: u32,
    pub fuel_amount: u64,
    pub timeout_ms: u64,
}

impl Default for ExecutionRequest {
    fn default() -> Self {
        ExecutionRequest {
            id: Uuid::new_v4(),
            language: Language::JavaScript,
            code: String::new(),
            files_needed: Vec::new(),
            args: Vec::new(),
            env_vars: HashMap::new(),
            memory_mb: 128,
            fuel_amount: 10_000_000,
            timeout_ms: 30_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub id: Uuid,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub memory_used_mb: u64,
    pub fuel_consumed: u64,
    pub error: Option<SandboxError>,
    pub backtrace: Option<String>,
}

impl ExecutionResult {
    pub fn new(id: Uuid) -> Self {
        ExecutionResult {
            id,
            success: true,
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 0,
            duration_ms: 0,
            memory_used_mb: 0,
            fuel_consumed: 0,
            error: None,
            backtrace: None,
        }
    }

    pub fn with_error(id: Uuid, error: SandboxError) -> Self {
        let mut r = ExecutionResult::new(id);
        r.success = false;
        r.exit_code = -1;
        r.error = Some(error);
        r
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub default_memory_mb: u32,
    pub default_fuel_amount: u64,
    pub default_timeout_ms: u64,
    pub cache_dir: PathBuf,
    pub runtimes_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub project_dir: PathBuf,
    pub allow_network: bool,
}

impl Default for EngineConfig {
    fn default() -> Self {
        let home = dirs_fallback();
        EngineConfig {
            default_memory_mb: 128,
            default_fuel_amount: 10_000_000,
            default_timeout_ms: 30_000,
            cache_dir: home.join(".oclushion").join("cache"),
            runtimes_dir: home.join(".oclushion").join("runtimes"),
            temp_dir: home.join(".oclushion").join("sandbox"),
            project_dir: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            allow_network: false,
        }
    }
}

fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home)
    } else if let Ok(home) = std::env::var("USERPROFILE") {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    }
}

pub type Result<T> = std::result::Result<T, SandboxError>;
