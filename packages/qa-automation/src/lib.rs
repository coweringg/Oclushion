pub mod sidecar_manager;
pub mod test_runner;
pub mod evidence;
pub mod bridge;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum QaError {
    #[error("Sidecar process crashed: {0}")]
    SidecarCrashed(String),
    #[error("Test failed: {reason} (evidence: {evidence_path:?})")]
    TestFailed {
        reason: String,
        evidence_path: Option<String>,
    },
    #[error("Operation timed out")]
    Timeout,
    #[error("IPC communication error: {0}")]
    IpcError(String),
    #[error("Browser launch failed: {0}")]
    BrowserLaunchFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("Zip error: {0}")]
    Zip(String),
}

impl From<zip::result::ZipError> for QaError {
    fn from(e: zip::result::ZipError) -> Self {
        QaError::Zip(e.to_string())
    }
}

pub type QaResult<T> = Result<T, QaError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSpec {
    pub id: Uuid,
    pub description: String,
    pub url: String,
    pub steps: Vec<TestStep>,
    pub timeout_ms: u64,
    pub viewports: Vec<Viewport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub action: StepAction,
    pub selector_hint: Option<String>,
    pub value: Option<String>,
    pub wait_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepAction {
    Navigate,
    Click,
    Type,
    Select,
    AssertVisible,
    AssertText,
    AssertScreenshot,
    Wait,
    Extract,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub width: u32,
    pub height: u32,
    pub label: String,
}

impl Viewport {
    pub fn desktop() -> Self {
        Self {
            width: 1920,
            height: 1080,
            label: "Desktop".into(),
        }
    }

    pub fn tablet() -> Self {
        Self {
            width: 768,
            height: 1024,
            label: "Tablet".into(),
        }
    }

    pub fn mobile() -> Self {
        Self {
            width: 375,
            height: 812,
            label: "Mobile".into(),
        }
    }

    pub fn all() -> Vec<Self> {
        vec![Self::desktop(), Self::tablet(), Self::mobile()]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub spec_id: Uuid,
    pub passed: bool,
    pub steps_passed: u32,
    pub steps_failed: u32,
    pub evidence: Vec<EvidenceFile>,
    pub duration_ms: u64,
    pub failure_reason: Option<String>,
    pub timestamps: TestTimestamps,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceFile {
    pub path: String,
    pub kind: EvidenceKind,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvidenceKind {
    Screenshot,
    Trace,
    Video,
    ConsoleLog,
    DomSnapshot,
}

impl std::fmt::Display for EvidenceKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Screenshot => write!(f, "screenshot"),
            Self::Trace => write!(f, "trace"),
            Self::Video => write!(f, "video"),
            Self::ConsoleLog => write!(f, "console_log"),
            Self::DomSnapshot => write!(f, "dom_snapshot"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestTimestamps {
    pub started_at: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarStatus {
    pub pid: u32,
    pub uptime_secs: u64,
    pub is_healthy: bool,
    pub active_tests: u32,
    pub browser_ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcMessage {
    pub id: Uuid,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcResponse {
    pub id: Uuid,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}
