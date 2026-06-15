pub mod parser;
pub mod semantic;
pub mod analysis;
pub mod linting;
pub mod query;
pub mod bridge;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CodeIntelError {
    #[error("Parse error: {0}")] Parse(String),
    #[error("Semantic error: {0}")] Semantic(String),
    #[error("File not found: {0}")] FileNotFound(PathBuf),
    #[error("File too large: {0} bytes")] FileTooLarge(u64),
    #[error("Parse timeout: {0}")] Timeout(String),
    #[error("IO error: {0}")] Io(#[from] std::io::Error),
    #[error("Serde error: {0}")] Serde(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, CodeIntelError>;

pub const SUPPORTED_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "mjs", "cjs"];

pub const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;

pub const PARSE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Location {
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SourceRange {
    pub file: PathBuf,
    pub start: Location,
    pub end: Location,
}
