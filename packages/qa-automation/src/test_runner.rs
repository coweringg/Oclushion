use crate::evidence::EvidenceManager;
use crate::sidecar_manager::SidecarManager;
use crate::{IpcMessage, IpcResponse, QaError, QaResult, TestResult, TestSpec, TestTimestamps};
use chrono::Utc;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct TestRunner {
    sidecar: Arc<Mutex<SidecarManager>>,
    #[allow(dead_code)]
    evidence_manager: EvidenceManager,
    running_tests: Mutex<HashSet<Uuid>>,
    #[allow(dead_code)]
    next_step_id: AtomicU32,
}

impl TestRunner {
    pub fn new(sidecar: Arc<Mutex<SidecarManager>>) -> Self {
        let data_dir = crate::sidecar_manager::SidecarManager::browser_path()
            .parent()
            .map(|p| p.join("qa"))
            .unwrap_or_else(|| PathBuf::from(".").join(".oclushion").join("qa"));

        Self {
            sidecar,
            evidence_manager: EvidenceManager::new(data_dir),
            running_tests: Mutex::new(HashSet::new()),
            next_step_id: AtomicU32::new(1),
        }
    }

    pub fn run_test(&self, spec: TestSpec) -> QaResult<TestResult> {
        let test_id = spec.id;
        self.running_tests.lock().unwrap().insert(test_id);

        let started_at = Utc::now().to_rfc3339();
        let start = std::time::Instant::now();

        let msg = IpcMessage {
            id: Uuid::new_v4(),
            method: "run_test".into(),
            params: serde_json::to_value(&spec)?,
        };

        let response: IpcResponse = {
            let sidecar = self.sidecar.lock().unwrap();
            sidecar.send_message(msg)?
        };

        if let Some(err) = &response.error {
            self.running_tests.lock().unwrap().remove(&test_id);
            return Err(QaError::TestFailed {
                reason: err.clone(),
                evidence_path: None,
            });
        }

        let result: TestResult = response
            .result
            .map(|v| serde_json::from_value(v))
            .transpose()?
            .unwrap_or_else(|| TestResult {
                spec_id: test_id,
                passed: false,
                steps_passed: 0,
                steps_failed: 0,
                evidence: vec![],
                duration_ms: start.elapsed().as_millis() as u64,
                failure_reason: Some("No result from sidecar".into()),
                timestamps: TestTimestamps {
                    started_at: started_at.clone(),
                    completed_at: Utc::now().to_rfc3339(),
                },
            });

        self.running_tests.lock().unwrap().remove(&test_id);
        Ok(result)
    }

    pub fn run_test_parallel(&self, specs: Vec<TestSpec>) -> Vec<QaResult<TestResult>> {
        let mut results = Vec::with_capacity(specs.len());
        for spec in specs {
            results.push(self.run_test(spec));
        }
        results
    }

    pub fn cancel_test(&self, test_id: Uuid) -> QaResult<()> {
        let msg = IpcMessage {
            id: Uuid::new_v4(),
            method: "cancel_test".into(),
            params: serde_json::json!({ "test_id": test_id }),
        };

        let sidecar = self.sidecar.lock().unwrap();
        let _ = sidecar.send_message(msg)?;
        self.running_tests.lock().unwrap().remove(&test_id);

        Ok(())
    }

    pub fn list_running_tests(&self) -> Vec<Uuid> {
        self.running_tests
            .lock()
            .unwrap()
            .iter()
            .copied()
            .collect()
    }
}
