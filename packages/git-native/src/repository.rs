use std::ops::Deref;
use std::path::Path;
use crate::{Result, Error};

pub struct Repository {
    pub inner: gix::Repository,
}

impl Deref for Repository {
    type Target = gix::Repository;
    fn deref(&self) -> &gix::Repository {
        &self.inner
    }
}

impl Repository {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let inner = gix::open(path.as_ref().to_path_buf())?;
        Ok(Self { inner })
    }

    pub fn open_from_env() -> Result<Self> {
        if let Ok(git_dir) = std::env::var("GIT_DIR") {
            Self::open(Path::new(&git_dir))
        } else {
            let cwd = std::env::current_dir()?;
            Self::open(&cwd)
        }
    }

    pub fn head_oid(&self) -> Result<String> {
        let head = self.inner.head().map_err(|e| Error::Ref(e.to_string()))?;
        let oid = head.into_peeled_id().map_err(|e| Error::Ref(e.to_string()))?;
        Ok(oid.detach().to_string())
    }

    pub fn head_short_sha(&self) -> Result<String> {
        let head = self.inner.head().map_err(|e| Error::Ref(e.to_string()))?;
        let oid = head.into_peeled_id().map_err(|e| Error::Ref(e.to_string()))?;
        Ok(oid.detach().to_hex_with_len(7).to_string())
    }

    pub fn is_dirty(&self) -> Result<bool> {
        let platform = self.inner.status(gix::progress::Discard)
            .map_err(|e| Error::Git(e.to_string()))?;
        let mut count = 0usize;
        for result in platform.index_worktree_rewrites(None).into_index_worktree_iter(Vec::new())
            .map_err(|e| Error::Git(e.to_string()))?
        {
            if result.is_ok() {
                count += 1;
                break;
            }
        }
        Ok(count > 0)
    }

    pub fn repo_path(&self) -> &Path {
        self.inner.path()
    }

    pub fn inner(&self) -> &gix::Repository {
        &self.inner
    }
}
