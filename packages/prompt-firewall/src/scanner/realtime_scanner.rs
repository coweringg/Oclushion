use std::collections::HashMap;
use std::fs;
use crate::pipeline::orchestrator::Orchestrator;
use crate::pipeline::result::AnalysisResult;

pub struct RealtimeScanner {
    orchestrator: Orchestrator,
    watched_files: HashMap<String, FileState>,
    running: bool,
    poll_interval_ms: u64,
}

struct FileState {
    last_modified: std::time::SystemTime,
    last_result: Option<AnalysisResult>,
}

impl RealtimeScanner {
    pub fn new(orchestrator: Orchestrator) -> Self {
        Self {
            orchestrator,
            watched_files: HashMap::new(),
            running: false,
            poll_interval_ms: 1000,
        }
    }

    pub fn with_poll_interval(mut self, ms: u64) -> Self {
        self.poll_interval_ms = ms;
        self
    }

    pub fn watch(&mut self, path: &str) {
        if let Ok(meta) = fs::metadata(path) {
            if let Ok(modified) = meta.modified() {
                self.watched_files.insert(
                    path.to_string(),
                    FileState {
                        last_modified: modified,
                        last_result: None,
                    },
                );
            }
        }
    }

    pub fn unwatch(&mut self, path: &str) {
        self.watched_files.remove(path);
    }

    pub fn start(&mut self) {
        self.running = true;
    }

    pub fn stop(&mut self) {
        self.running = false;
    }

    pub fn poll(&mut self) -> Vec<(String, AnalysisResult)> {
        let mut changes = Vec::new();
        if !self.running {
            return changes;
        }

        let paths: Vec<String> = self.watched_files.keys().cloned().collect();
        for path in paths {
            if let Ok(meta) = fs::metadata(&path) {
                if let Ok(modified) = meta.modified() {
                    if let Some(state) = self.watched_files.get(&path) {
                        if modified != state.last_modified && modified.duration_since(state.last_modified).is_ok() {
                            if let Ok(content) = fs::read_to_string(&path) {
                                let result = self.orchestrator.analyze(&content, &path);
                                if let Some(state) = self.watched_files.get_mut(&path) {
                                    state.last_modified = modified;
                                    state.last_result = Some(result.clone());
                                }
                                changes.push((path, result));
                            }
                        }
                    }
                }
            }
        }
        changes
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    pub fn watched_files(&self) -> Vec<String> {
        self.watched_files.keys().cloned().collect()
    }
}
