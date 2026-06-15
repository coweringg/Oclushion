use std::time::{SystemTime, UNIX_EPOCH};
use crate::quarantine::{QuarantineEntry, QuarantineStatus};
use crate::QuarantineError;

pub struct Manager {
    entries: Vec<QuarantineEntry>,
}

fn now_str() -> String {
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", dur.as_secs())
}

impl Manager {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn quarantine(&mut self, file_path: &str, detection_reason: &str, severity: &str) -> Result<QuarantineEntry, QuarantineError> {
        if self.entries.iter().any(|e| e.file_path == file_path && e.status == QuarantineStatus::Active) {
            return Err(QuarantineError::AlreadyQuarantined(file_path.to_string()));
        }

        let entry = QuarantineEntry {
            file_path: file_path.to_string(),
            detection_reason: detection_reason.to_string(),
            severity: severity.to_string(),
            timestamp: now_str(),
            status: QuarantineStatus::Active,
        };
        self.entries.push(entry.clone());
        Ok(entry)
    }

    pub fn release(&mut self, file_path: &str) -> Result<(), QuarantineError> {
        let entry = self.entries
            .iter_mut()
            .find(|e| e.file_path == file_path && e.status == QuarantineStatus::Active)
            .ok_or_else(|| QuarantineError::NotFound(file_path.to_string()))?;
        entry.status = QuarantineStatus::Released;
        Ok(())
    }

    pub fn mark_reviewed(&mut self, file_path: &str) -> Result<(), QuarantineError> {
        let entry = self.entries
            .iter_mut()
            .find(|e| e.file_path == file_path && e.status == QuarantineStatus::Active)
            .ok_or_else(|| QuarantineError::NotFound(file_path.to_string()))?;
        entry.status = QuarantineStatus::Reviewed;
        Ok(())
    }

    pub fn override_quarantine(&mut self, file_path: &str) -> Result<(), QuarantineError> {
        let entry = self.entries
            .iter_mut()
            .find(|e| e.file_path == file_path && e.status == QuarantineStatus::Active)
            .ok_or_else(|| QuarantineError::NotFound(file_path.to_string()))?;
        entry.status = QuarantineStatus::Overridden;
        Ok(())
    }

    pub fn list(&self) -> &[QuarantineEntry] {
        &self.entries
    }

    pub fn active_count(&self) -> usize {
        self.entries.iter().filter(|e| e.status == QuarantineStatus::Active).count()
    }

    pub fn is_quarantined(&self, file_path: &str) -> bool {
        self.entries.iter().any(|e| e.file_path == file_path && e.status == QuarantineStatus::Active)
    }
}
