use crate::repository::Repository;

pub struct CommitAmend;

impl CommitAmend {
    pub fn amend_last_commit(repo: &Repository, msg: &str) -> crate::Result<String> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let ref_name = head.referent_name().map(|r| r.as_bstr().to_string());

        let mut head_mut = head;
        let current_commit = head_mut
            .peel_to_commit_in_place()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let tree_id = current_commit.tree_id()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let parent_ids: Vec<gix::ObjectId> = current_commit.parent_ids().map(|id| id.detach()).collect();

        let decoded = current_commit.decode()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let commit = gix_object::Commit {
            tree: tree_id.detach(),
            parents: parent_ids.into(),
            author: gix::actor::Signature {
                name: decoded.author.name.to_owned(),
                email: decoded.author.email.to_owned(),
                time: gix::date::Time {
                    seconds: now as i64,
                    offset: 0,
                    sign: gix::date::time::Sign::Plus,
                },
            },
            committer: gix::actor::Signature {
                name: decoded.committer.name.to_owned(),
                email: decoded.committer.email.to_owned(),
                time: gix::date::Time {
                    seconds: now as i64,
                    offset: 0,
                    sign: gix::date::time::Sign::Plus,
                },
            },
            encoding: decoded.encoding.map(|e| e.to_owned()),
            message: msg.into(),
            extra_headers: decoded.extra_headers.iter().map(|(k, v)| (k.to_vec().into(), v.clone().into_owned())).collect(),
        };

        let commit_id = repo
            .write_object(commit)
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        if let Some(ref_name) = ref_name {
            use gix::refs::transaction::PreviousValue;
            repo.reference(ref_name.as_str(), commit_id.detach(), PreviousValue::Any, "")
                .map_err(|e| crate::Error::Git(e.to_string()))?;
        } else {
            let git_dir = repo.path();
            std::fs::write(
                git_dir.join("HEAD"),
                format!("{}\n", commit_id.detach()),
            )
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        }

        Ok(commit_id.to_string())
    }

    pub fn amend_last_commit_no_edit(repo: &Repository) -> crate::Result<String> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut head_mut = head;
        let current_commit = head_mut
            .peel_to_commit_in_place()
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let msg_raw = current_commit.message_raw_sloppy().to_string();
        let msg = msg_raw.trim();

        Self::amend_last_commit(repo, msg)
    }
}
