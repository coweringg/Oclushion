use crate::repository::Repository;
use std::process::Command;

pub struct SubmoduleManager;

impl SubmoduleManager {
    pub fn list_submodules(repo: &Repository) -> crate::Result<Vec<String>> {
        let gitdir = repo.path().to_path_buf();
        let modules_dir = gitdir.join("modules");

        let mut submodules = Vec::new();

        if modules_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&modules_dir) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        submodules.push(
                            entry.file_name().to_string_lossy().to_string(),
                        );
                    }
                }
            }
        }

        let config = repo.config_snapshot();

        if let Some(sections) = config.sections_by_name("submodule") {
            for section in sections {
                if let Some(sub_name) = section.header().subsection_name() {
                    let name = sub_name.to_string();
                    if !submodules.contains(&name) {
                        submodules.push(name);
                    }
                }
            }
        }

        Ok(submodules)
    }

    pub fn update_submodules(repo: &Repository) -> crate::Result<()> {
        let workdir = repo
            .work_dir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;

        let output = Command::new("git")
            .args(["submodule", "update", "--init", "--recursive"])
            .current_dir(workdir)
            .output()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(crate::Error::Git(format!(
                "Failed to update submodules: {}",
                stderr
            )));
        }

        Ok(())
    }
}
