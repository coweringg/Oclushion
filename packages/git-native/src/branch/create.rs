use crate::repository::Repository;

pub struct BranchCreate;

impl BranchCreate {
    pub fn create_branch(
        repo: &Repository,
        name: &str,
        oid: gix::ObjectId,
    ) -> crate::Result<String> {
        let refname = format!("refs/heads/{}", name);
        use gix::refs::transaction::PreviousValue;
        let reference = repo
            .reference(refname.as_str(), oid, PreviousValue::Any, "")
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        Ok(reference.name().as_bstr().to_string())
    }

    pub fn create_branch_from_head(repo: &Repository, name: &str) -> crate::Result<String> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut head_mut = head;
        let commit = head_mut
            .peel_to_commit_in_place()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let oid = commit.id().detach();
        Self::create_branch(repo, name, oid)
    }
}
