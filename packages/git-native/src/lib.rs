use thiserror::Error;

pub mod repository;
pub mod diff;
pub mod branch;
pub mod commit;
pub mod status;
pub mod blame;
pub mod remote;
pub mod worktree;
pub mod lfs;
pub mod submodules;
pub mod hooks;
pub mod health;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Git error: {0}")] Git(String),
    #[error("Repository error: {0}")] Repo(String),
    #[error("Branch error: {0}")] Branch(String),
    #[error("Commit error: {0}")] Commit(String),
    #[error("Diff error: {0}")] Diff(String),
    #[error("IO error: {0}")] Io(#[from] std::io::Error),
    #[error("Reference error: {0}")] Ref(String),
    #[error("Blame error: {0}")] Blame(String),
    #[error("Remote error: {0}")] Remote(String),
    #[error("Worktree error: {0}")] Worktree(String),
    #[error("Message: {0}")] Message(String),
    #[error("Branch not found: {0}")] BranchNotFound(String),
}

impl From<gix::open::Error> for Error {
    fn from(e: gix::open::Error) -> Self {
        Error::Repo(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffEntry {
    pub file: String,
    pub status: String,
    pub added_lines: usize,
    pub removed_lines: usize,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub origin: String,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEntry {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameLine {
    pub line_number: u32,
    pub content: String,
    pub commit_oid: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitEntry {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}
