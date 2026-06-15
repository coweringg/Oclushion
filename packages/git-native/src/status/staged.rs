use crate::repository::Repository;
use crate::StatusEntry;

pub struct StagedStatus;

impl StagedStatus {
    pub fn staged_files(repo: &Repository) -> crate::Result<Vec<StatusEntry>> {
        let mut entries = Vec::new();

        let head_entries: Vec<(String, gix::ObjectId)> = {
            let head = repo.head().ok();
            match head.and_then(|h| {
                let mut h_mut = h;
                h_mut.peel_to_commit_in_place().ok()
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

        let index = repo
            .index()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        for idx_entry in index.entries() {
            let path = std::str::from_utf8(idx_entry.path(&index))
                .unwrap_or("")
                .to_string();
            let head_match = head_entries.iter().find(|(n, _)| n == &path);

            match head_match {
                None => {
                    entries.push(StatusEntry {
                        path,
                        status: "added".to_string(),
                    });
                }
                Some((_, hoid)) if *hoid != idx_entry.id => {
                    entries.push(StatusEntry {
                        path,
                        status: "modified".to_string(),
                    });
                }
                _ => {}
            }
        }

        for (hpath, _) in &head_entries {
            if !index
                .entries()
                .iter()
                .any(|e| std::str::from_utf8(e.path(&index)).unwrap_or("") == hpath)
            {
                entries.push(StatusEntry {
                    path: hpath.clone(),
                    status: "deleted".to_string(),
                });
            }
        }

        Ok(entries)
    }
}
