pub mod pipeline;
pub mod patterns;
pub mod quarantine;
pub mod audit;
pub mod scanner;
pub mod bridge;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScanError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Pattern not found: {0}")]
    PatternNotFound(String),
    #[error("Scan timed out")]
    Timeout,
    #[error("Classifier error: {0}")]
    Classifier(String),
}

#[derive(Error, Debug)]
pub enum QuarantineError {
    #[error("Entry not found: {0}")]
    NotFound(String),
    #[error("Already quarantined: {0}")]
    AlreadyQuarantined(String),
    #[error("Blocked by allowlist: {0}")]
    AllowlistBlocked(String),
}

#[derive(Error, Debug)]
pub enum AuditError {
    #[error("Cannot modify append-only log")]
    AppendOnlyViolation,
    #[error("Log corrupted: {0}")]
    LogCorrupted(String),
}

#[derive(Error, Debug)]
pub enum PatternError {
    #[error("Pattern not found: {0}")]
    NotFound(String),
    #[error("Invalid regex: {0}")]
    InvalidRegex(String),
    #[error("Update failed: {0}")]
    UpdateFailed(String),
}

#[derive(Error, Debug)]
pub enum FirewallError {
    #[error("Scan error: {0}")]
    Scan(#[from] ScanError),
    #[error("Quarantine error: {0}")]
    Quarantine(#[from] QuarantineError),
    #[error("Audit error: {0}")]
    Audit(#[from] AuditError),
    #[error("Pattern error: {0}")]
    Pattern(#[from] PatternError),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ThreatCategory {
    Injection,
    Jailbreak,
    DataExfil,
    UnicodeAttack,
    EncodedPayload,
    Benign,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Verdict {
    Safe,
    Suspicious,
    Quarantined,
}
