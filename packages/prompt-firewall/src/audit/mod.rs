pub mod logger;
pub mod reporter;

pub use logger::Logger;
pub use reporter::Reporter;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: String,
    pub action: String,
    pub file: String,
    pub user: String,
    pub justification: Option<String>,
}
