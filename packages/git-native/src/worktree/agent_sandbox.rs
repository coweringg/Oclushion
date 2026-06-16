use crate::repository::Repository;
use std::process::Command;

pub struct AgentSandbox;

impl AgentSandbox {
    pub fn create_worktree(
        repo: &Repository,
        branch: &str,
        path: impl AsRef<std::path::Path>,
    ) -> crate::Result<()> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let path_ref = path.as_ref();
        std::fs::create_dir_all(path_ref)?;

        let output = Command::new("git")
            .args(["worktree", "add"])
            .arg(path_ref)
            .arg(branch)
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Failed to create worktree: {}",
                stderr
            )));
        }

        Ok(())
    }

    pub fn remove_worktree(
        repo: &Repository,
        path: impl AsRef<std::path::Path>,
    ) -> crate::Result<()> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["worktree", "remove", "--force"])
            .arg(path.as_ref())
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Failed to remove worktree: {}",
                stderr
            )));
        }

        let _ = std::fs::remove_dir_all(path.as_ref());

        Ok(())
    }

    pub fn list_agent_worktrees(repo: &Repository) -> crate::Result<Vec<String>> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["worktree", "list"])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            return Err(crate::Error::Git("Failed to list worktrees".to_string()));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut agent_worktrees = Vec::new();

        for line in stdout.lines() {
            if line.contains("oclushion/agent/") || line.contains("oclushion-agent-") {
                agent_worktrees.push(line.to_string());
            }
        }

        Ok(agent_worktrees)
    }
}
