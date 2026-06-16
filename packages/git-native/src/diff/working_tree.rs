use crate::repository::Repository;
use crate::{DiffEntry, DiffHunk};

pub struct WorkingTreeDiff;

impl WorkingTreeDiff {
    pub fn diff_working_tree(repo: &Repository) -> crate::Result<Vec<DiffEntry>> {
        let workdir = match repo.workdir() {
            Some(d) => d,
            None => return Ok(Vec::new()),
        };

        let mut entries = Vec::new();
        let mut dirs = vec![workdir.to_path_buf()];

        while let Some(dir) = dirs.pop() {
            if let Ok(rd) = std::fs::read_dir(&dir) {
                for entry in rd.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        if !name.starts_with('.') && name != "target" {
                            dirs.push(path);
                        }
                    } else if path.is_file() {
                        let rel_path = path
                            .strip_prefix(workdir)
                            .unwrap_or(&path)
                            .to_string_lossy()
                            .to_string()
                            .replace('\\', "/");
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            entries.push(DiffEntry {
                                file: rel_path,
                                status: "modified".to_string(),
                                added_lines: content.lines().count(),
                                removed_lines: 0,
                                hunks: vec![DiffHunk {
                                    header: String::new(),
                                    old_start: 0,
                                    old_lines: 0,
                                    new_start: 1,
                                    new_lines: content.lines().count() as u32,
                                    content: content
                                        .lines()
                                        .map(|l| format!("+{}\n", l))
                                        .collect(),
                                }],
                            });
                        }
                    }
                }
            }
        }

        Ok(entries)
    }

    pub fn diff_index(repo: &Repository) -> crate::Result<Vec<DiffEntry>> {
        let head_tree = repo.head_tree()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let index = repo
            .index()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let head_entries: Vec<_> = head_tree.iter().filter_map(|e| e.ok()).collect();
        let mut entries = Vec::new();

        for idx_entry in index.entries() {
            let name = std::str::from_utf8(idx_entry.path(&index))
                .unwrap_or("")
                .to_string();
            let head_entry = head_entries.iter().find(|e| {
                std::str::from_utf8(e.filename()).unwrap_or("") == name
            });

            match head_entry {
                None => {
                    entries.push(DiffEntry {
                        file: name,
                        status: "added".to_string(),
                        added_lines: 0,
                        removed_lines: 0,
                        hunks: Vec::new(),
                    });
                }
                Some(h) if h.oid() != idx_entry.id => {
                    entries.push(DiffEntry {
                        file: name,
                        status: "modified".to_string(),
                        added_lines: 0,
                        removed_lines: 0,
                        hunks: Vec::new(),
                    });
                }
                _ => {}
            }
        }

        Ok(entries)
    }
}
