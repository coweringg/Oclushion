use crate::repository::Repository;
use std::process::Command;

pub struct RemoteFetch;

impl RemoteFetch {
    pub fn fetch(repo: &Repository, remote_name: &str) -> crate::Result<String> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["fetch", remote_name])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() { stderr } else { stdout })
        } else {
            Err(crate::Error::Git(format!("Fetch failed: {}", stderr)))
        }
    }

    pub fn fetch_all(repo: &Repository) -> crate::Result<String> {
        Self::fetch(repo, "--all")
    }
}
