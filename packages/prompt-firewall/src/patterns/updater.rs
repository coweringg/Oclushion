use sha2::{Sha256, Digest};
use crate::PatternError;

pub struct Updater;

impl Updater {
    pub fn new() -> Self {
        Self
    }

    pub fn verify_signature(data: &[u8], expected_hash: &str) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        let hex = format!("{:x}", result);
        hex == expected_hash.to_lowercase()
    }

    pub fn update_from_json(json: &str, expected_hash: &str) -> Result<Vec<crate::pipeline::pattern_matcher::PatternEntry>, PatternError> {
        let data = json.as_bytes();
        if !Self::verify_signature(data, expected_hash) {
            return Err(PatternError::UpdateFailed("Hash mismatch".into()));
        }

        let entries: Vec<crate::pipeline::pattern_matcher::PatternEntry> =
            serde_json::from_str(json)
                .map_err(|e| PatternError::UpdateFailed(format!("Invalid JSON: {}", e)))?;

        if entries.is_empty() {
            return Err(PatternError::UpdateFailed("Empty pattern set".into()));
        }

        for entry in &entries {
            if entry.id.is_empty() || entry.phrase.is_empty() {
                return Err(PatternError::UpdateFailed(format!(
                    "Invalid entry: {:?}",
                    entry.id
                )));
            }
            regex::Regex::new(&entry.phrase)
                .map_err(|e| PatternError::InvalidRegex(format!("{}: {}", entry.id, e)))?;
        }

        Ok(entries)
    }

    pub fn compute_hash(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }
}
