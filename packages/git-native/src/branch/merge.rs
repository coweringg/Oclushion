use crate::repository::Repository;
use std::process::Command;

pub struct BranchMerge;

impl BranchMerge {
    pub fn merge_branch(
        repo: &Repository,
        branch_name: &str,
        msg: &str,
    ) -> crate::Result<String> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["merge", branch_name, "-m", msg])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(format!("Merge successful: {}", stdout))
        } else {
            Err(crate::Error::Git(format!(
                "Merge failed: {} {}",
                stdout, stderr
            )))
        }
    }

    pub fn detect_conflicts(repo: &Repository, branch_name: &str) -> crate::Result<Vec<String>> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["merge", "--no-commit", "--no-ff", branch_name])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let _ = Command::new("git")
            .args(["merge", "--abort"])
            .current_dir(workdir)
            .output();

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let mut conflicts = Vec::new();

        for line in stderr.lines() {
            if line.contains("CONFLICT") || line.contains("conflict") {
                if let Some(file) = line.split(" in ").nth(1) {
                    conflicts.push(file.trim().to_string());
                } else if let Some(file) = line.split(':').nth(1) {
                    conflicts.push(file.trim().to_string());
                } else {
                    conflicts.push(line.to_string());
                }
            }
        }

        if conflicts.is_empty() && !output.status.success() {
            let status_output = Command::new("git")
                .args(["diff", "--name-only", "--diff-filter=U"])
                .current_dir(workdir)
                .output()
                .map_err(|e| crate::Error::Git(e.to_string()))?;
            let status_stdout = String::from_utf8_lossy(&status_output.stdout);
            for line in status_stdout.lines() {
                if !line.is_empty() {
                    conflicts.push(line.to_string());
                }
            }
        }

        Ok(conflicts)
    }
}
