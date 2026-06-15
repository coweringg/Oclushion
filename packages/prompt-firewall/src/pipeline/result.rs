use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

use crate::pipeline::classifier::ClassificationResult;
use crate::pipeline::entropy_analyzer::EntropyResult;
use crate::pipeline::invisible_chars::InvisibleCharMatch;
use crate::pipeline::pattern_matcher::PatternMatch;
use crate::{Severity, ThreatCategory, Verdict};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseResult {
    pub phase_name: String,
    pub score: f64,
    pub details: String,
    pub matches: Vec<PhaseMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PhaseMatch {
    InvisibleChar(InvisibleCharMatch),
    Pattern(PatternMatch),
    Entropy(EntropyResult),
    Classification(ClassificationResult),
    Normalization { original: String, normalized: String, count: usize },
}

fn now_rfc3339() -> String {
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    let micros = dur.subsec_nanos() / 1_000_000;
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        1970 + (days / 365) as u32,
        1 + ((days % 365) / 30) as u32,
        1 + ((days % 365) % 30) as u32,
        hours,
        minutes,
        seconds,
        micros
    )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub file_path: String,
    pub verdict: Verdict,
    pub severity: Severity,
    pub phases: Vec<PhaseResult>,
    pub timestamp: String,
    pub overall_score: f64,
    pub top_threat_category: ThreatCategory,
    pub details: String,
}

impl AnalysisResult {
    pub fn safe(file_path: &str) -> Self {
        Self {
            file_path: file_path.to_string(),
            verdict: Verdict::Safe,
            severity: Severity::None,
            phases: Vec::new(),
            timestamp: now_rfc3339(),
            overall_score: 0.0,
            top_threat_category: ThreatCategory::Benign,
            details: "No threats detected".to_string(),
        }
    }

    pub fn quarantined(
        file_path: &str,
        severity: Severity,
        phases: Vec<PhaseResult>,
        overall_score: f64,
        category: ThreatCategory,
        details: String,
    ) -> Self {
        Self {
            file_path: file_path.to_string(),
            verdict: Verdict::Quarantined,
            severity,
            phases,
            timestamp: now_rfc3339(),
            overall_score,
            top_threat_category: category,
            details,
        }
    }

    pub fn suspicious(
        file_path: &str,
        severity: Severity,
        phases: Vec<PhaseResult>,
        overall_score: f64,
        category: ThreatCategory,
        details: String,
    ) -> Self {
        Self {
            file_path: file_path.to_string(),
            verdict: Verdict::Suspicious,
            severity,
            phases,
            timestamp: now_rfc3339(),
            overall_score,
            top_threat_category: category,
            details,
        }
    }
}
