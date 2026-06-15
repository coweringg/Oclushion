use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::audit::AuditEntry;
use crate::pipeline::result::AnalysisResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityReport {
    pub period_start: String,
    pub period_end: String,
    pub stats: ReportStats,
    pub top_threats: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportStats {
    pub total_scans: usize,
    pub threats_found: usize,
    pub false_positives: usize,
    pub quarantined: usize,
    pub overrides: usize,
    pub allowed: usize,
    pub categories: HashMap<String, usize>,
}

pub struct Reporter;

impl Reporter {
    pub fn new() -> Self {
        Self
    }

    pub fn generate_report(
        &self,
        entries: &[AuditEntry],
        results: &[AnalysisResult],
        start: &str,
        end: &str,
    ) -> SecurityReport {
        let total_scans = results.len();
        let threats_found = results.iter().filter(|r| r.verdict != crate::Verdict::Safe).count();
        let quarantined = results.iter().filter(|r| r.verdict == crate::Verdict::Quarantined).count();
        let allowed = results.iter().filter(|r| r.verdict == crate::Verdict::Safe).count();
        let overrides = entries.iter().filter(|e| e.action == "override").count();

        let mut categories: HashMap<String, usize> = HashMap::new();
        for r in results {
            let cat = format!("{:?}", r.top_threat_category);
            *categories.entry(cat).or_insert(0) += 1;
        }

        let mut top_threats: Vec<String> = results
            .iter()
            .filter(|r| r.verdict != crate::Verdict::Safe)
            .map(|r| format!("{} ({:.2})", r.file_path, r.overall_score))
            .collect();
        top_threats.sort_by(|a, b| b.len().cmp(&a.len()));
        top_threats.truncate(10);

        SecurityReport {
            period_start: start.to_string(),
            period_end: end.to_string(),
            stats: ReportStats {
                total_scans,
                threats_found,
                false_positives: 0,
                quarantined,
                overrides,
                allowed,
                categories,
            },
            top_threats,
        }
    }

    pub fn summary(report: &SecurityReport) -> String {
        format!(
            "Security Report ({} to {}):\n  Scans: {}\n  Threats: {}\n  Quarantined: {}\n  Overrides: {}\n  Categories: {:?}\n  Top threats: {:?}",
            report.period_start, report.period_end,
            report.stats.total_scans,
            report.stats.threats_found,
            report.stats.quarantined,
            report.stats.overrides,
            report.stats.categories,
            report.top_threats,
        )
    }
}
