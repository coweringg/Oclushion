use crate::evidence::EvidenceManager;
use crate::sidecar_manager::SidecarManager;
use crate::test_runner::TestRunner;
use crate::{IpcMessage, QaError, QaResult, TestSpec, Viewport};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct TauriCommands {
    runner: TestRunner,
    sidecar: Arc<Mutex<SidecarManager>>,
    evidence: EvidenceManager,
}

impl TauriCommands {
    pub fn new(sidecar_path: PathBuf, data_dir: PathBuf) -> Self {
        let sidecar = Arc::new(Mutex::new(SidecarManager::new(sidecar_path, data_dir.clone())));
        let runner = TestRunner::new(Arc::clone(&sidecar));
        let evidence = EvidenceManager::new(data_dir.join("qa"));
        Self {
            runner,
            sidecar,
            evidence,
        }
    }

    pub fn run_qa_test(&self, spec_json: String) -> QaResult<String> {
        let spec: TestSpec = serde_json::from_str(&spec_json)?;
        let result = self.runner.run_test(spec)?;
        Ok(serde_json::to_string(&result)?)
    }

    pub fn run_qa_test_parallel(&self, specs_json: String) -> QaResult<String> {
        let specs: Vec<TestSpec> = serde_json::from_str(&specs_json)?;
        let results = self.runner.run_test_parallel(specs);
        let results_json: Vec<QaResult<crate::TestResult>> = results;
        let serialized: Vec<serde_json::Value> = results_json
            .into_iter()
            .map(|r| match r {
                Ok(result) => serde_json::to_value(result).unwrap_or_default(),
                Err(e) => serde_json::json!({ "error": e.to_string() }),
            })
            .collect();
        Ok(serde_json::to_string(&serialized)?)
    }

    pub fn cancel_qa_test(&self, test_id: String) -> QaResult<()> {
        let id = Uuid::parse_str(&test_id)
            .map_err(|e| QaError::InvalidArgument(format!("Invalid UUID: {e}")))?;
        self.runner.cancel_test(id)
    }

    pub fn get_sidecar_status(&self) -> QaResult<String> {
        let sidecar = self.sidecar.lock().unwrap();
        let status = sidecar.get_status();
        Ok(serde_json::to_string(&status)?)
    }

    pub fn restart_sidecar(&self) -> QaResult<()> {
        let sidecar = self.sidecar.lock().unwrap();
        sidecar.restart()
    }

    pub fn get_test_evidence(&self, test_id: String) -> QaResult<String> {
        let evidence = self.evidence.get_test_evidence(&test_id);
        Ok(serde_json::to_string(&evidence)?)
    }

    pub fn get_disk_usage(&self) -> QaResult<u64> {
        Ok(self.evidence.get_disk_usage())
    }

    pub fn cleanup_old_evidence(&self, max_age_days: u64) -> QaResult<u64> {
        Ok(self.evidence.cleanup_old_evidence(max_age_days))
    }

    pub fn capture_screenshot(
        &self,
        url: String,
        viewport_json: String,
    ) -> QaResult<String> {
        let viewport: Viewport = serde_json::from_str(&viewport_json)?;

        let msg = IpcMessage {
            id: Uuid::new_v4(),
            method: "capture_screenshot".into(),
            params: serde_json::json!({
                "url": url,
                "viewport": {
                    "width": viewport.width,
                    "height": viewport.height,
                    "label": viewport.label
                }
            }),
        };

        let sidecar = self.sidecar.lock().unwrap();
        let response = sidecar.send_message(msg)?;

        if let Some(err) = &response.error {
            return Err(QaError::TestFailed {
                reason: err.clone(),
                evidence_path: None,
            });
        }

        let path = response
            .result
            .and_then(|v| v.as_str().map(String::from))
            .ok_or_else(|| QaError::IpcError("No screenshot path returned".into()))?;

        Ok(path)
    }
}
