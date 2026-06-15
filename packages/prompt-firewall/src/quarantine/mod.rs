pub mod manager;
pub mod allowlist;
pub mod override_log;

pub use manager::Manager;
pub use allowlist::Allowlist;
pub use override_log::OverrideLog;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantineEntry {
    pub file_path: String,
    pub detection_reason: String,
    pub severity: String,
    pub timestamp: String,
    pub status: QuarantineStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QuarantineStatus {
    Active,
    Reviewed,
    Overridden,
    Released,
}
