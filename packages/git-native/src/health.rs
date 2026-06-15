use crate::repository::Repository;
use std::process::Command;

pub struct RepoHealth;

impl RepoHealth {
    pub fn run_gc(repo: &Repository) -> crate::Result<String> {
        let workdir = repo
            .work_dir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["gc", "--aggressive", "--prune=now"])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() { stderr } else { stdout })
        } else {
            Err(crate::Error::Git(format!("GC failed: {}", stderr)))
        }
    }

    pub fn verify_integrity(repo: &Repository) -> crate::Result<Vec<String>> {
        let git_dir = repo.path().to_path_buf();
        let mut issues = Vec::new();

        let output = Command::new("git")
            .args(["fsck", "--full", "--strict"])
            .current_dir(&git_dir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        for line in stdout.lines() {
            if !line.is_empty() {
                issues.push(line.to_string());
            }
        }

        if issues.is_empty() && output.status.success() {
            issues.push("Repository integrity verified".to_string());
        }

        Ok(issues)
    }

    pub fn repo_size(repo: &Repository) -> u64 {
        let git_dir = repo.path();
        Self::dir_size(git_dir)
    }

    pub fn count_objects(repo: &Repository) -> u64 {
        let git_dir = repo.path();
        let objects_dir = git_dir.join("objects");

        let mut count = 0u64;
        if let Ok(entries) = std::fs::read_dir(&objects_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if name.len() == 2 && name.chars().all(|c| c.is_ascii_hexdigit()) {
                        if let Ok(pack_entries) = std::fs::read_dir(&path) {
                            count += pack_entries.flatten().count() as u64;
                        }
                    }
                } else if path.extension().map_or(false, |e| e == "pack") {
                    count += 1;
                }
            }
        }

        count
    }

    fn dir_size(path: &std::path::Path) -> u64 {
        let mut total = 0u64;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    total += Self::dir_size(&path);
                } else if let Ok(metadata) = std::fs::metadata(&path) {
                    total += metadata.len();
                }
            }
        }
        total
    }
}
