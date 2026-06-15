use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod transport;
pub mod server_manager;
pub mod protocol;
pub mod security;
pub mod built_in;
pub mod client;
pub mod bridge;

#[derive(Debug, thiserror::Error)]
pub enum McpError {
    #[error("Transport error: {0}")]
    TransportError(String),
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    #[error("Server not found: {0}")]
    ServerNotFound(String),
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    #[error("Resource not found: {0}")]
    ResourceNotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Handshake failed: {0}")]
    HandshakeFailed(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Connection lost: {0}")]
    ConnectionLost(String),
    #[error("Credential error: {0}")]
    CredentialError(String),
    #[error(transparent)]
    JsonError(#[from] serde_json::Error),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, McpError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransportType {
    Stdio,
    Sse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub name: String,
    pub transport_type: TransportType,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub env_vars: HashMap<String, String>,
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapabilities {
    pub tools: Vec<ToolDefinition>,
    pub resources: Vec<ResourceDefinition>,
    pub prompts: Vec<PromptDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceDefinition {
    pub uri: String,
    pub name: String,
    pub description: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptDefinition {
    pub name: String,
    pub description: String,
    pub arguments: Vec<PromptArg>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArg {
    pub name: String,
    pub description: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallRequest {
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub content: Vec<ToolContent>,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text(String),
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource(ResourceContent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceContent {
    pub uri: String,
    pub text: Option<String>,
    pub blob: Option<String>,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub name: String,
    pub is_running: bool,
    pub pid: Option<u32>,
    pub uptime_secs: u64,
    pub capabilities: Option<ServerCapabilities>,
    pub last_ping_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permission {
    pub server_name: String,
    pub tool_name: String,
    pub access: AccessLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccessLevel {
    #[serde(rename = "read_only")]
    ReadOnly,
    #[serde(rename = "read_write")]
    ReadWrite,
    #[serde(rename = "destructive")]
    Destructive,
    #[serde(rename = "custom")]
    Custom(String),
}

impl Default for AccessLevel {
    fn default() -> Self {
        AccessLevel::ReadOnly
    }
}
