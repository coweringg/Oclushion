use crate::repository::Repository;

pub struct BranchSwitch;

impl BranchSwitch {
    pub fn checkout_branch(repo: &Repository, name: &str) -> crate::Result<()> {
        let refname = format!("refs/heads/{}", name);
        let reference = repo
            .find_reference(refname.as_str())
            .map_err(|_| crate::Error::BranchNotFound(name.to_string()))?;
        let commit_id = reference
            .id()
            .detach();

        let git_dir = repo.path().to_path_buf();
        std::fs::write(git_dir.join("HEAD"), format!("ref: refs/heads/{}\n", name))
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let tree = repo
            .find_commit(commit_id)
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let tree_obj = tree
            .tree()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let workdir = match repo.workdir() {
            Some(d) => d.to_path_buf(),
            None => return Ok(()),
        };

        let tree_entries: Vec<_> = tree_obj.iter().filter_map(|e| e.ok()).collect();
        for entry in &tree_entries {
            let filename = std::str::from_utf8(entry.filename())
                .unwrap_or("")
                .to_string();
            let file_path = workdir.join(&filename);

            if let Ok(blob) = repo.find_blob(entry.oid()) {
                if let Some(parent) = file_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&file_path, blob.data.as_slice());
            }
        }

        Ok(())
    }

    pub fn checkout_commit(repo: &Repository, oid: gix::ObjectId) -> crate::Result<()> {
        let commit = repo
            .find_commit(oid)
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let tree_obj = commit
            .tree()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let git_dir = repo.path().to_path_buf();
        std::fs::write(git_dir.join("HEAD"), format!("{}\n", oid))
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let workdir = match repo.workdir() {
            Some(d) => d.to_path_buf(),
            None => return Ok(()),
        };

        let tree_entries: Vec<_> = tree_obj.iter().filter_map(|e| e.ok()).collect();
        for entry in &tree_entries {
            let filename = std::str::from_utf8(entry.filename())
                .unwrap_or("")
                .to_string();
            let file_path = workdir.join(&filename);

            if let Ok(blob) = repo.find_blob(entry.oid()) {
                if let Some(parent) = file_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&file_path, blob.data.as_slice());
            }
        }

        Ok(())
    }
}
