use std::time::{SystemTime, UNIX_EPOCH};
use crate::audit::AuditEntry;
use crate::AuditError;

fn now_str() -> String {
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", dur.as_secs())
}

pub struct Logger {
    entries: Vec<AuditEntry>,
}

impl Logger {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn log(&mut self, action: &str, file: &str, user: &str, justification: Option<&str>) {
        self.entries.push(AuditEntry {
            timestamp: now_str(),
            action: action.to_string(),
            file: file.to_string(),
            user: user.to_string(),
            justification: justification.map(|s| s.to_string()),
        });
    }

    pub fn log_scan(&mut self, file: &str, user: &str) {
        self.log("scan", file, user, None);
    }

    pub fn log_quarantine(&mut self, file: &str, user: &str, reason: &str) {
        self.log("quarantine", file, user, Some(reason));
    }

    pub fn log_override(&mut self, file: &str, user: &str, justification: &str) {
        self.log("override", file, user, Some(justification));
    }

    pub fn log_release(&mut self, file: &str, user: &str, justification: &str) {
        self.log("release", file, user, Some(justification));
    }

    pub fn entries(&self) -> &[AuditEntry] {
        &self.entries
    }

    pub fn query(&self, file: &str) -> Vec<AuditEntry> {
        self.entries
            .iter()
            .filter(|e| e.file == file)
            .cloned()
            .collect()
    }

    pub fn query_action(&self, action: &str) -> Vec<AuditEntry> {
        self.entries
            .iter()
            .filter(|e| e.action == action)
            .cloned()
            .collect()
    }

    pub fn recent(&self, n: usize) -> Vec<AuditEntry> {
        let len = self.entries.len();
        let start = len.saturating_sub(n);
        self.entries[start..].to_vec()
    }

    pub fn try_modify(&mut self) -> Result<(), AuditError> {
        Err(AuditError::AppendOnlyViolation)
    }
}
