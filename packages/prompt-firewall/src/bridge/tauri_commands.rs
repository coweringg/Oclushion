use crate::audit::logger::Logger;
use crate::audit::reporter::{Reporter, SecurityReport};
use crate::pipeline::orchestrator::Orchestrator;
use crate::pipeline::result::AnalysisResult;
use crate::quarantine::manager::Manager as QuarantineManager;
use crate::quarantine::allowlist::Allowlist;
use crate::quarantine::override_log::OverrideLog;
use crate::quarantine::QuarantineEntry;
use crate::scanner::file_scanner::FileScanner;
use crate::scanner::project_scanner::ProjectScanner;
use crate::patterns::all_patterns;

pub struct TauriCommands {
    scanner: FileScanner,
    project_scanner: ProjectScanner,
    quarantine: QuarantineManager,
    allowlist: Allowlist,
    override_log: OverrideLog,
    audit_log: Logger,
    reporter: Reporter,
}

impl TauriCommands {
    pub fn new() -> Self {
        let patterns = all_patterns();
        let matcher = crate::pipeline::pattern_matcher::PatternMatcher::new(&patterns)
            .expect("Failed to build pattern matcher");

        Self {
            scanner: FileScanner::new(Orchestrator::new(matcher.clone())),
            project_scanner: ProjectScanner::new(Orchestrator::new(matcher)),
            quarantine: QuarantineManager::new(),
            allowlist: Allowlist::new(),
            override_log: OverrideLog::new(),
            audit_log: Logger::new(),
            reporter: Reporter::new(),
        }
    }

    pub fn scan_file(&mut self, path: &str) -> Result<AnalysisResult, String> {
        self.audit_log.log_scan(path, "tauri-user");
        let result = self.scanner.scan_file(path).map_err(|e| e.to_string())?;

        if result.verdict != crate::Verdict::Safe {
            if !self.allowlist.is_allowed(path) {
                let _ = self.quarantine.quarantine(
                    path,
                    &result.details,
                    &format!("{:?}", result.severity),
                );
                self.audit_log.log_quarantine(path, "tauri-user", &result.details);
            }
        }

        Ok(result)
    }

    pub fn scan_project(&mut self, dir: &str) -> Result<Vec<AnalysisResult>, String> {
        self.audit_log.log("scan_project", dir, "tauri-user", None);
        let results = self.project_scanner.scan_project(dir).map_err(|e| e.to_string())?;

        for result in &results {
            if result.verdict != crate::Verdict::Safe {
                if !self.allowlist.is_allowed(&result.file_path) {
                    let _ = self.quarantine.quarantine(
                        &result.file_path,
                        &result.details,
                        &format!("{:?}", result.severity),
                    );
                }
            }
        }

        Ok(results)
    }

    pub fn get_quarantine_list(&self) -> &[QuarantineEntry] {
        self.quarantine.list()
    }

    pub fn add_to_allowlist(&mut self, path: &str) {
        self.allowlist.add(path);
        self.audit_log.log("allowlist_add", path, "tauri-user", Some("Added by user"));
    }

    pub fn remove_from_allowlist(&mut self, path: &str) {
        self.allowlist.remove(path);
        self.audit_log.log("allowlist_remove", path, "tauri-user", None);
    }

    pub fn override_quarantine(&mut self, path: &str, justification: &str) -> Result<(), String> {
        if self.allowlist.is_allowed(path) {
            return Err("File is in allowlist, not quarantined".to_string());
        }
        self.quarantine.override_quarantine(path).map_err(|e| e.to_string())?;
        self.override_log.log_override(path, "override", justification);
        self.audit_log.log_override(path, "tauri-user", justification);
        Ok(())
    }

    pub fn get_audit_log(&self, n: usize) -> Vec<crate::audit::AuditEntry> {
        self.audit_log.recent(n)
    }

    pub fn get_security_report(&self, start: &str, end: &str) -> SecurityReport {
        let entries = self.audit_log.entries();
        let results = Vec::new();
        self.reporter.generate_report(entries, &results, start, end)
    }

    pub fn update_patterns(&mut self, json: &str, hash: &str) -> Result<(), String> {
        let entries = crate::patterns::updater::Updater::update_from_json(json, hash)
            .map_err(|e| e.to_string())?;
        let matcher = crate::pipeline::pattern_matcher::PatternMatcher::new(&entries)
            .map_err(|e| e.to_string())?;
        let orchestrator = Orchestrator::new(matcher);
        self.scanner = FileScanner::new(orchestrator);
        self.audit_log.log("patterns_updated", "global", "tauri-user", None);
        Ok(())
    }
}
