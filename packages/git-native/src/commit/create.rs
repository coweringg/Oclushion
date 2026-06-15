use crate::repository::Repository;
use gix_object::Commit;

pub struct CommitCreate;

impl CommitCreate {
    pub fn create_commit(repo: &Repository, msg: &str) -> crate::Result<String> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut head_mut = head;
        let parent_commit = head_mut
            .peel_to_commit_in_place()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let tree_id = parent_commit.tree_id()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let parent_id = parent_commit.id();
        Self::write_commit_with_parents(repo, tree_id.detach(), &[parent_id.detach()], msg)
    }

    pub fn create_commit_from_tree(
        repo: &Repository,
        tree: gix::ObjectId,
        msg: &str,
    ) -> crate::Result<String> {
        let head = repo.head().ok();
        let parent_ids: Vec<gix::ObjectId> = if let Some(h) = head {
            if let Ok(mut head_mut) = Ok::<_, ()>(h) {
                if let Ok(commit) = head_mut.peel_to_commit_in_place() {
                    vec![commit.id().detach()]
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };
        Self::write_commit_with_parents(repo, tree, &parent_ids, msg)
    }

    fn write_commit_with_parents(
        repo: &Repository,
        tree: gix::ObjectId,
        parent_ids: &[gix::ObjectId],
        msg: &str,
    ) -> crate::Result<String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let commit = Commit {
            tree,
            parents: parent_ids.to_vec().into(),
            author: gix::actor::Signature {
                name: gix::bstr::BString::from("Oclushion Agent"),
                email: gix::bstr::BString::from("agent@oclushion.dev"),
                time: gix::date::Time {
                    seconds: now as i64,
                    offset: 0,
                    sign: gix::date::time::Sign::Plus,
                },
            },
            committer: gix::actor::Signature {
                name: gix::bstr::BString::from("Oclushion Agent"),
                email: gix::bstr::BString::from("agent@oclushion.dev"),
                time: gix::date::Time {
                    seconds: now as i64,
                    offset: 0,
                    sign: gix::date::time::Sign::Plus,
                },
            },
            encoding: None,
            message: msg.into(),
            extra_headers: Vec::new(),
        };

        let commit_id = repo
            .write_object(commit)
            .map_err(|e| crate::Error::Git(e.to_string()))?;

        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        if let Some(referent_name) = head.referent_name() {
            let ref_name = referent_name.as_bstr().to_string();
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

    pub fn commit_all(repo: &Repository, msg: &str) -> crate::Result<String> {
        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut head_mut = head;
        let parent_commit = head_mut
            .peel_to_commit_in_place()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let tree_id = parent_commit.tree_id()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let parent_id = parent_commit.id();

        let workdir = match repo.work_dir() {
            Some(d) => d,
            None => {
                return Self::write_commit_with_parents(repo, tree_id.detach(), &[parent_id.detach()], msg);
            }
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
                        let rel = path
                            .strip_prefix(workdir)
                            .unwrap_or(&path)
                            .to_string_lossy()
                            .to_string()
                            .replace('\\', "/");
                        if let Ok(content) = std::fs::read(&path) {
                            entries.push((rel, content));
                        }
                    }
                }
            }
        }

        if entries.is_empty() {
            return Self::write_commit_with_parents(repo, tree_id.detach(), &[parent_id.detach()], msg);
        }

        let tree_id = repo
            .find_tree(tree_id.detach())
            .map_err(|e| crate::Error::Git(e.to_string()))?
            .id();

        Self::write_commit_with_parents(repo, tree_id.detach(), &[parent_id.detach()], msg)
    }

    #[allow(dead_code)]
    pub(crate) fn build_commit_bytes(
        tree: gix::ObjectId,
        parent_ids: &[gix::ObjectId],
        msg: &str,
    ) -> Vec<u8> {
        let mut buf = Vec::new();

        buf.extend_from_slice(b"tree ");
        buf.extend_from_slice(tree.to_string().as_bytes());
        buf.push(b'\n');

        for parent in parent_ids {
            buf.extend_from_slice(b"parent ");
            buf.extend_from_slice(parent.to_string().as_bytes());
            buf.push(b'\n');
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        buf.extend_from_slice(b"author Oclushion Agent <agent@oclushion.dev> ");
        buf.extend_from_slice(now.to_string().as_bytes());
        buf.extend_from_slice(b" +0000\n");

        buf.extend_from_slice(b"committer Oclushion Agent <agent@oclushion.dev> ");
        buf.extend_from_slice(now.to_string().as_bytes());
        buf.extend_from_slice(b" +0000\n");

        buf.push(b'\n');
        buf.extend_from_slice(msg.as_bytes());
        buf.push(b'\n');

        buf
    }
}
