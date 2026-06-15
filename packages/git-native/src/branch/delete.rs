use crate::repository::Repository;
use gix::refs::transaction::{PreviousValue, RefEdit};

pub struct BranchDelete;

impl BranchDelete {
    pub fn delete_branch(repo: &Repository, name: &str) -> crate::Result<()> {
        let refname = format!("refs/heads/{}", name);
        let full_name: gix::refs::FullName = gix::refs::FullName::try_from(refname.as_str())
            .map_err(|e| crate::Error::Ref(e.to_string()))?;

        let edit = RefEdit {
            change: gix::refs::transaction::Change::Delete {
                expected: PreviousValue::Any,
                log: gix::refs::transaction::RefLog::AndReference,
            },
            name: full_name,
            deref: true,
        };

        repo.edit_reference(edit)
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        Ok(())
    }

    pub fn delete_agent_branches(repo: &Repository) -> crate::Result<Vec<String>> {
        let mut deleted = Vec::new();
        let references = repo
            .references()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let all_refs: Vec<_> = references
            .all()
            .map_err(|e| crate::Error::Git(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        let mut edits = Vec::new();
        for reference in &all_refs {
            let name = reference.name().as_bstr().to_string();
            if name.starts_with("refs/heads/oclushion/agent/")
                || name.starts_with("refs/heads/oclushion-agent/")
            {
                let full_name: gix::refs::FullName = gix::refs::FullName::try_from(name.as_str())
                    .map_err(|e| crate::Error::Ref(e.to_string()))?;
                let edit = RefEdit {
                    change: gix::refs::transaction::Change::Delete {
                        expected: PreviousValue::Any,
                        log: gix::refs::transaction::RefLog::AndReference,
                    },
                    name: full_name,
                    deref: true,
                };
                edits.push(edit);
                deleted.push(name);
            }
        }

        if !edits.is_empty() {
            repo.edit_references(edits)
                .map_err(|e| crate::Error::Git(e.to_string()))?;
        }

        Ok(deleted)
    }
}
