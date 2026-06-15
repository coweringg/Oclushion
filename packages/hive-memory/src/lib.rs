pub mod db;
pub mod embedding;
pub mod search;
pub mod lifecycle;
pub mod sync;
pub mod access_control;
pub mod metrics;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    General(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

#[derive(Error, Debug)]
pub enum EmbeddingError {
    #[error("Embedding error: {0}")]
    General(String),
    #[error("Model not loaded")]
    ModelNotLoaded,
}

#[derive(Error, Debug)]
pub enum SearchError {
    #[error("Search error: {0}")]
    General(String),
    #[error("Empty query vector")]
    EmptyQuery,
}

#[derive(Error, Debug)]
pub enum LifecycleError {
    #[error("Lifecycle error: {0}")]
    General(String),
}

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("Sync error: {0}")]
    General(String),
    #[error("Encryption error: {0}")]
    Crypto(#[from] CryptoError),
}

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Encryption error: {0}")]
    Encrypt(String),
    #[error("Decryption error: {0}")]
    Decrypt(String),
    #[error("Invalid key")]
    InvalidKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Insight {
    pub id: Uuid,
    pub vector: Vec<f32>,
    pub text: String,
    pub source_project: String,
    pub author: String,
    pub confidence: f32,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub agent_role: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub insight: Insight,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub model_path: String,
    pub max_batch_size: usize,
    pub cache_size: usize,
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            model_path: String::from("all-MiniLM-L6-v2.onnx"),
            max_batch_size: 32,
            cache_size: 10000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub export_path: String,
    pub conflict_strategy: String,
    pub encrypt: bool,
    pub password: String,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            export_path: String::from("./exports"),
            conflict_strategy: String::from("last_write_wins"),
            encrypt: false,
            password: String::new(),
        }
    }
}
