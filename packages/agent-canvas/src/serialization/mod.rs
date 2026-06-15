pub mod schema;
pub mod export;
pub mod import;
pub mod versioning;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WorkflowMetadata {
    pub author: String,
    pub tags: Vec<String>,
    pub description: String,
    pub version: String,
}

impl WorkflowMetadata {
    pub fn new(author: String, tags: Vec<String>, description: String, version: String) -> Self {
        WorkflowMetadata { author, tags, description, version }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SerializeError {
    InvalidSchema(String),
    VersionMismatch { expected: u32, found: u32 },
    MigrationFailed { from: u32, to: u32, reason: String },
    ValidationError(String),
}

impl std::fmt::Display for SerializeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SerializeError::InvalidSchema(msg) => write!(f, "Invalid schema: {}", msg),
            SerializeError::VersionMismatch { expected, found } => {
                write!(f, "Version mismatch: expected {}, found {}", expected, found)
            }
            SerializeError::MigrationFailed { from, to, reason } => {
                write!(f, "Migration from {} to {} failed: {}", from, to, reason)
            }
            SerializeError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for SerializeError {}
