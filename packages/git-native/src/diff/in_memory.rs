use crate::repository::Repository;
use crate::{DiffEntry, Result};
use gix::object::tree::diff::ChangeDetached;

pub struct InMemoryDiff;

impl InMemoryDiff {
    pub fn diff_trees(repo: &Repository, old_oid: gix::ObjectId, new_oid: gix::ObjectId) -> Result<Vec<DiffEntry>> {
        let old_tree = repo.find_tree(old_oid).ok();
        let new_tree = repo.find_tree(new_oid).ok();

        let changes = repo.diff_tree_to_tree(old_tree.as_ref(), new_tree.as_ref(), gix::diff::Options::default())
            .map_err(|e| crate::Error::Diff(e.to_string()))?;

        let mut entries = Vec::new();
        for change in &changes {
            let file = match change {
                ChangeDetached::Addition { location, .. }
                | ChangeDetached::Deletion { location, .. }
                | ChangeDetached::Modification { location, .. }
                | ChangeDetached::Rewrite { location, .. } => location.to_string(),
            };
            let status = match change {
                ChangeDetached::Addition { .. } => "added",
                ChangeDetached::Deletion { .. } => "deleted",
                ChangeDetached::Modification { .. } => "modified",
                ChangeDetached::Rewrite { .. } => "rewrite",
            };
            entries.push(DiffEntry {
                file,
                status: status.to_string(),
                added_lines: 0,
                removed_lines: 0,
                hunks: Vec::new(),
            });
        }
        Ok(entries)
    }

    pub fn diff_oids(repo: &Repository, old_oid: gix::ObjectId, new_oid: gix::ObjectId) -> Result<Vec<DiffEntry>> {
        Self::diff_trees(repo, old_oid, new_oid)
    }
}
