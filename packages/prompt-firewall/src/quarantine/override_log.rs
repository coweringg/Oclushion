use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverrideEntry {
    pub timestamp: String,
    pub file: String,
    pub decision: String,
    pub justification: String,
}

fn now_str() -> String {
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", dur.as_secs())
}

pub struct OverrideLog {
    entries: Vec<OverrideEntry>,
}

impl OverrideLog {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn log_override(&mut self, file: &str, decision: &str, justification: &str) {
        self.entries.push(OverrideEntry {
            timestamp: now_str(),
            file: file.to_string(),
            decision: decision.to_string(),
            justification: justification.to_string(),
        });
    }

    pub fn entries(&self) -> &[OverrideEntry] {
        &self.entries
    }

    pub fn recent(&self, n: usize) -> Vec<OverrideEntry> {
        let len = self.entries.len();
        let start = len.saturating_sub(n);
        self.entries[start..].to_vec()
    }

    pub fn for_file(&self, file: &str) -> Vec<OverrideEntry> {
        self.entries
            .iter()
            .filter(|e| e.file == file)
            .cloned()
            .collect()
    }

    pub fn count(&self) -> usize {
        self.entries.len()
    }
}
