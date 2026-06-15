use std::fs;
use std::time::Instant;
use crate::pipeline::orchestrator::Orchestrator;
use crate::pipeline::result::AnalysisResult;
use crate::ScanError;

pub struct FileScanner {
    orchestrator: Orchestrator,
}

impl FileScanner {
    pub fn new(orchestrator: Orchestrator) -> Self {
        Self { orchestrator }
    }

    pub fn scan_file(&self, path: &str) -> Result<AnalysisResult, ScanError> {
        let _start = Instant::now();
        let content = fs::read_to_string(path)
            .map_err(|e| ScanError::Io(e))?;

        if content.is_empty() {
            return Ok(AnalysisResult::safe(path));
        }

        Ok(self.orchestrator.analyze(&content, path))
    }

    pub fn scan_file_with_timeout(&self, path: &str, timeout_ms: u64) -> Result<AnalysisResult, ScanError> {
        let start = Instant::now();
        let result = self.scan_file(path)?;
        let elapsed = start.elapsed().as_millis() as u64;
        if elapsed > timeout_ms {
            return Err(ScanError::Timeout);
        }
        Ok(result)
    }
}
