use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OxlintDiagnostic {
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub severity: String,
    pub rule: String,
    pub message: String,
}

pub struct OxlintBridge;

impl OxlintBridge {
    pub fn lint_file(path: &Path) -> Result<Vec<OxlintDiagnostic>> {
        let output = Command::new("oxlint")
            .arg("--format")
            .arg("json")
            .arg(path)
            .output()
            .map_err(|e| crate::CodeIntelError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("oxlint not found: {}", e))))?;

        if output.status.success() || !output.stderr.is_empty() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            Self::parse_output(&stdout)
        } else {
            Ok(vec![])
        }
    }

    pub fn lint_project(path: &Path) -> Result<Vec<OxlintDiagnostic>> {
        let output = Command::new("oxlint")
            .arg("--format")
            .arg("json")
            .arg(path)
            .output()
            .map_err(|e| crate::CodeIntelError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("oxlint not found: {}", e))))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        Self::parse_output(&stdout)
    }

    fn parse_output(json: &str) -> Result<Vec<OxlintDiagnostic>> {
        if json.trim().is_empty() {
            return Ok(vec![]);
        }
        let diagnostics: Vec<OxlintDiagnostic> = serde_json::from_str(json)
            .unwrap_or_else(|_| vec![]);
        Ok(diagnostics)
    }
}
