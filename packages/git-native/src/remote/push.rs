use crate::repository::Repository;
use std::process::Command;

pub struct RemotePush;

impl RemotePush {
    pub fn push(repo: &Repository, remote_name: &str, branch: &str) -> crate::Result<String> {
        let workdir = repo
            .work_dir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["push", remote_name, branch])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() { stderr } else { stdout })
        } else {
            Err(crate::Error::Git(format!("Push failed: {}", stderr)))
        }
    }

    pub fn push_all(repo: &Repository) -> crate::Result<String> {
        let workdir = repo
            .work_dir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["push", "--all"])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() { stderr } else { stdout })
        } else {
            Err(crate::Error::Git(format!("Push failed: {}", stderr)))
        }
    }
}
