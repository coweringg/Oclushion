use crate::repository::Repository;
use crate::StatusEntry;

pub struct WorkingTreeStatus;

impl WorkingTreeStatus {
    pub fn status(repo: &Repository) -> crate::Result<Vec<StatusEntry>> {
        let mut entries = Vec::new();
        let workdir = match repo.workdir() {
            Some(d) => d.to_path_buf(),
            None => return Ok(entries),
        };

        let head_entries: Vec<(String, gix::ObjectId)> = {
            let head = repo.head().ok();
            match head.and_then(|h| {
                let mut h_mut = h;
                h_mut.peel_to_commit().ok()
            }) {
                Some(commit) => {
                    if let Ok(tree) = commit.tree() {
                tree.iter()
                    .filter_map(|e| e.ok())
                    .map(|e| {
                        (
                            std::str::from_utf8(e.filename())
                                .unwrap_or("")
                                .to_string(),
                            e.oid().to_owned(),
                        )
                    })
                    .collect()
                    } else {
                        Vec::new()
                    }
                }
                None => Vec::new(),
            }
        };

        let mut dirs = vec![workdir.clone()];
        while let Some(dir) = dirs.pop() {
            if let Ok(rd) = std::fs::read_dir(&dir) {
                for entry in rd.flatten() {
                    let path = entry.path();
                    let rel = path.strip_prefix(&workdir).unwrap_or(&path).to_string_lossy().to_string().replace('\\', "/");
                    if rel.starts_with(".git") || rel.starts_with("target/") {
                        continue;
                    }
                    if path.is_dir() {
                        dirs.push(path);
                    } else if path.is_file() {
                        if !head_entries.iter().any(|(n, _)| n == &rel) {
                            entries.push(StatusEntry {
                                path: rel,
                                status: "untracked".to_string(),
                            });
                        } else if let Ok(content) = std::fs::read(&path) {
                            let head_oid = head_entries.iter().find(|(n, _)| n == &rel).map(|(_, o)| *o);
                            if let Some(hoid) = head_oid {
                                if let Ok(blob) = repo.find_blob(hoid) {
                                    if blob.data != content {
                                        entries.push(StatusEntry {
                                            path: rel,
                                            status: "modified".to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(entries)
    }
}
