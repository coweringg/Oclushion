use crate::repository::Repository;
use std::process::Command;

pub struct GitHooks;

impl GitHooks {
    pub fn run_pre_commit(repo: &Repository) -> crate::Result<()> {
        let hooks_dir = Self::hooks_dir(repo)?;
        let hook_path = hooks_dir.join("pre-commit");

        if !hook_path.exists() {
            return Ok(());
        }

        if !Self::is_executable(&hook_path) {
            return Ok(());
        }

        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new(&hook_path)
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Pre-commit hook failed: {}",
                stderr
            )));
        }

        Ok(())
    }

    pub fn run_post_commit(repo: &Repository) -> crate::Result<()> {
        let hooks_dir = Self::hooks_dir(repo)?;
        let hook_path = hooks_dir.join("post-commit");

        if !hook_path.exists() || !Self::is_executable(&hook_path) {
            return Ok(());
        }

        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let _ = Command::new(&hook_path)
            .current_dir(workdir)
            .output();

        Ok(())
    }

    pub fn run_pre_push(repo: &Repository) -> crate::Result<()> {
        let hooks_dir = Self::hooks_dir(repo)?;
        let hook_path = hooks_dir.join("pre-push");

        if !hook_path.exists() || !Self::is_executable(&hook_path) {
            return Ok(());
        }

        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new(&hook_path)
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Pre-push hook failed: {}",
                stderr
            )));
        }

        Ok(())
    }

    fn hooks_dir(repo: &Repository) -> crate::Result<std::path::PathBuf> {
        let git_dir = repo.path().to_path_buf();
        let hooks_dir = git_dir.join("hooks");
        if !hooks_dir.exists() {
            std::fs::create_dir_all(&hooks_dir)?;
        }
        Ok(hooks_dir)
    }

    fn is_executable(path: &std::path::Path) -> bool {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(path) {
                return metadata.permissions().mode() & 0o111 != 0;
            }
            false
        }
        #[cfg(not(unix))]
        {
            path.exists()
        }
    }
}
