use std::fs;
use std::path::Path;
use crate::pipeline::orchestrator::Orchestrator;
use crate::pipeline::result::AnalysisResult;
use crate::ScanError;

pub struct ProjectScanner {
    orchestrator: Orchestrator,
    ignore_patterns: Vec<String>,
}

impl ProjectScanner {
    pub fn new(orchestrator: Orchestrator) -> Self {
        Self {
            orchestrator,
            ignore_patterns: vec![
                "node_modules".into(),
                ".git".into(),
                "target".into(),
                ".next".into(),
                "dist".into(),
                "build".into(),
                ".venv".into(),
                "__pycache__".into(),
                ".svelte-kit".into(),
            ],
        }
    }

    pub fn with_ignore_patterns(mut self, patterns: Vec<String>) -> Self {
        self.ignore_patterns = patterns;
        self
    }

    pub fn scan_project(&self, project_dir: &str) -> Result<Vec<AnalysisResult>, ScanError> {
        let mut results = Vec::new();
        let dir = Path::new(project_dir);
        if !dir.is_dir() {
            return Err(ScanError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Directory not found: {}", project_dir),
            )));
        }
        self.scan_dir(dir, &mut results)?;
        Ok(results)
    }

    fn scan_dir(&self, dir: &Path, results: &mut Vec<AnalysisResult>) -> Result<(), ScanError> {
        for entry in fs::read_dir(dir).map_err(ScanError::Io)? {
            let entry = entry.map_err(ScanError::Io)?;
            let path = entry.path();

            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if self.should_ignore(&name) {
                    continue;
                }
                self.scan_dir(&path, results)?;
            } else if path.is_file() {
                if self.is_text_file(&path) {
                    let path_str = path.to_string_lossy().to_string();
                    match self.orchestrator.analyze(
                        &fs::read_to_string(&path).unwrap_or_default(),
                        &path_str,
                    ) {
                        r if r.verdict != crate::Verdict::Safe => results.push(r),
                        _ => {}
                    }
                }
            }
        }
        Ok(())
    }

    fn should_ignore(&self, name: &str) -> bool {
        self.ignore_patterns.iter().any(|p| name == p || name.starts_with('.'))
    }

    fn is_text_file(&self, path: &Path) -> bool {
        let extensions = [
            "rs", "ts", "tsx", "js", "jsx", "py", "rb", "go", "java", "kt",
            "swift", "c", "cpp", "h", "hpp", "cs", "php", "r", "scala", "zig",
            "toml", "json", "yaml", "yml", "md", "txt", "html", "css", "scss",
            "svelte", "vue", "astro", "sql", "graphql", "prisma", "env", "ini",
            "cfg", "conf", "xml", "svg", "sh", "bash", "zsh", "ps1", "bat",
        ];
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| extensions.contains(&e))
            .unwrap_or(false)
    }
}
