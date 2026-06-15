use std::collections::HashMap;
use crate::pipeline::result::AnalysisResult;
use crate::quarantine::QuarantineEntry;
use crate::ThreatCategory;

pub struct SanoShieldIntegration {
    connected: bool,
    endpoint: String,
    shared_findings: Vec<SharedFinding>,
}

#[derive(Debug, Clone)]
pub struct SharedFinding {
    pub source: String,
    pub file_path: String,
    pub threat_category: ThreatCategory,
    pub score: f64,
    pub timestamp: String,
}

impl SanoShieldIntegration {
    pub fn new(endpoint: &str) -> Self {
        Self {
            connected: false,
            endpoint: endpoint.to_string(),
            shared_findings: Vec::new(),
        }
    }

    pub fn connect(&mut self) -> Result<(), String> {
        self.connected = true;
        Ok(())
    }

    pub fn disconnect(&mut self) {
        self.connected = false;
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }

    pub fn share_finding(&mut self, result: &AnalysisResult) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to SanoShield".into());
        }
        self.shared_findings.push(SharedFinding {
            source: "prompt-firewall".into(),
            file_path: result.file_path.clone(),
            threat_category: result.top_threat_category.clone(),
            score: result.overall_score,
            timestamp: result.timestamp.clone(),
        });
        Ok(())
    }

    pub fn share_quarantine(&mut self, entry: &QuarantineEntry) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to SanoShield".into());
        }
        self.shared_findings.push(SharedFinding {
            source: "prompt-firewall".into(),
            file_path: entry.file_path.clone(),
            threat_category: ThreatCategory::Injection,
            score: match entry.severity.as_str() {
                "Critical" => 0.95,
                "High" => 0.8,
                "Medium" => 0.5,
                _ => 0.3,
            },
            timestamp: entry.timestamp.clone(),
        });
        Ok(())
    }

    pub fn findings(&self) -> &[SharedFinding] {
        &self.shared_findings
    }

    pub fn get_sano_shield_status(&self) -> HashMap<String, String> {
        let mut status = HashMap::new();
        status.insert("connected".to_string(), self.connected.to_string());
        status.insert("endpoint".to_string(), self.endpoint.clone());
        status.insert("shared_findings".to_string(), self.shared_findings.len().to_string());
        status
    }
}
