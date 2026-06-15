pub mod sidecar;
pub mod inference;
pub mod models;
pub mod hardware;
pub mod config;
pub mod metrics;

use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum SidecarError {
    #[error("Failed to spawn sidecar process: {0}")]
    SpawnFailed(String),
    #[error("Sidecar process not running")]
    NotRunning,
    #[error("Failed to kill sidecar process: {0}")]
    KillFailed(String),
    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),
    #[error("Timeout waiting for sidecar: {0}")]
    Timeout(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum InferenceError {
    #[error("HTTP request failed: {0}")]
    HttpRequestFailed(String),
    #[error("Failed to parse response: {0}")]
    ParseError(String),
    #[error("Stream error: {0}")]
    StreamError(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Sidecar error: {0}")]
    Sidecar(#[from] SidecarError),
}

#[derive(Debug, thiserror::Error)]
pub enum ModelError {
    #[error("Model not found: {0}")]
    NotFound(String),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("SHA256 mismatch for {0}")]
    Sha256Mismatch(String),
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("License check failed: {0}")]
    LicenseError(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum HardwareError {
    #[error("Failed to detect hardware: {0}")]
    DetectionFailed(String),
    #[error("Unsupported backend: {0}")]
    UnsupportedBackend(String),
    #[error("Insufficient memory: {0}")]
    InsufficientMemory(String),
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Failed to read config: {0}")]
    ReadFailed(String),
    #[error("Failed to write config: {0}")]
    WriteFailed(String),
    #[error("Invalid config: {0}")]
    InvalidConfig(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for CompletionRequest {
    fn default() -> Self {
        Self {
            prompt: String::new(),
            suffix: None,
            max_tokens: Some(512),
            temperature: Some(0.7),
            top_p: Some(0.9),
            stop: None,
            stream: None,
            model: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub id: String,
    pub model: String,
    pub choices: Vec<Choice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: u32,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub description: String,
    pub license: String,
    pub is_installed: bool,
    pub file_size_bytes: u64,
    pub requires_gpu: bool,
    pub quantization: Option<String>,
    pub download_url: Option<String>,
    pub expected_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub backend: BackendKind,
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BackendKind {
    Cuda,
    Metal,
    Vulkan,
    Rocm,
    Cpu,
}

impl std::fmt::Display for BackendKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BackendKind::Cuda => write!(f, "cuda"),
            BackendKind::Metal => write!(f, "metal"),
            BackendKind::Vulkan => write!(f, "vulkan"),
            BackendKind::Rocm => write!(f, "rocm"),
            BackendKind::Cpu => write!(f, "cpu"),
        }
    }
}
