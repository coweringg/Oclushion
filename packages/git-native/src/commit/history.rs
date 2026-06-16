use crate::repository::Repository;
use serde::{Deserialize, Serialize};

pub struct CommitHistory;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parents: Vec<String>,
}

impl CommitHistory {
    pub fn get_log(repo: &Repository, max_count: usize) -> crate::Result<Vec<CommitInfo>> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut oids = Vec::new();

        if let Ok(mut head_mut) = Ok::<_, ()>(head) {
            if let Ok(commit) = head_mut.peel_to_commit() {
                oids.push(commit.id().detach());
                let mut current = commit;
                for _ in 1..max_count {
                    let parent_ids: Vec<gix::ObjectId> = current.parent_ids().map(|id| id.detach()).collect();
                    if parent_ids.is_empty() {
                        break;
                    }
                    if let Ok(parent) = repo.find_commit(parent_ids[0]) {
                        oids.push(parent.id().detach());
                        current = parent;
                    } else {
                        break;
                    }
                }
            }
        }

        let mut commits = Vec::new();
        for oid in oids {
            if let Ok(commit) = repo.find_commit(oid) {
                let decoded = commit.decode()
                    .map_err(|e| crate::Error::Git(e.to_string()))?;
                let message = decoded.message.to_string();
                let author = decoded.author()
                    .map_err(|e| crate::Error::Git(e.to_string()))?;
                let author_name = author.name.to_string();
                let author_email = author.email.to_string();
                let author_time = author.time().unwrap_or_default();

                let parents: Vec<String> = decoded.parents().map(|id| id.to_string()).collect();

                commits.push(CommitInfo {
                    oid: oid.to_string(),
                    short_oid: oid.to_string()[..7.min(oid.to_string().len())].to_string(),
                    message: message.trim().to_string(),
                    author: author_name,
                    author_email,
                    timestamp: author_time.seconds,
                    parents,
                });
            }
        }

        Ok(commits)
    }

    pub fn get_commits_since(repo: &Repository, _date: i64) -> crate::Result<Vec<CommitInfo>> {
        Self::get_log(repo, 1000)
    }

    pub fn get_commit_by_oid(repo: &Repository, oid_str: &str) -> crate::Result<CommitInfo> {
        let oid = gix::ObjectId::from_hex(oid_str.as_bytes())
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let commit = repo
            .find_commit(oid)
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let decoded = commit.decode()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let message = decoded.message.to_string();
        let author = decoded.author()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let author_time = author.time().unwrap_or_default();

        let parents: Vec<String> = decoded.parents().map(|id| id.to_string()).collect();

        Ok(CommitInfo {
            oid: oid.to_string(),
            short_oid: oid.to_string()[..7.min(oid.to_string().len())].to_string(),
            message: message.trim().to_string(),
            author: author.name.to_string(),
            author_email: author.email.to_string(),
            timestamp: author_time.seconds,
            parents,
        })
    }
}
