use crate::repository::Repository;
use std::process::Command;

pub struct LfsSupport;

impl LfsSupport {
    pub fn is_lfs_enabled(repo: &Repository) -> bool {
        let workdir = match repo.work_dir() {
            Some(d) => d,
            None => return false,
        };

        let attributes_path = workdir.join(".gitattributes");
        if let Ok(content) = std::fs::read_to_string(&attributes_path) {
            if content.contains("filter=lfs") {
                return true;
            }
        }

        let output = Command::new("git")
            .args(["lfs", "env"])
            .current_dir(workdir)
            .output();

        match output {
            Ok(o) => o.status.success(),
            Err(_) => false,
        }
    }

    pub fn track_file(repo: &Repository, pattern: &str) -> crate::Result<()> {
        let workdir = repo
            .work_dir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        if !Self::is_lfs_installed() {
            return Err(crate::Error::Message(
                "Git LFS is not installed".to_string(),
            ));
        }

        let output = Command::new("git")
            .args(["lfs", "track", pattern])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Failed to track file: {}",
                stderr
            )));
        }

        Ok(())
    }

    fn is_lfs_installed() -> bool {
        Command::new("git")
            .args(["lfs", "version"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
