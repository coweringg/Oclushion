use std::process::Command;
use tempfile::tempdir;

fn setup_repo() -> tempfile::TempDir {
    let dir = tempdir().expect("failed to create temp dir");
    let status = Command::new("git")
        .args(["init"])
        .current_dir(dir.path())
        .output()
        .expect("failed to init repo");
    assert!(status.status.success());

    std::fs::write(dir.path().join("test.txt"), b"hello\n").expect("failed to write");
    let add = Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .expect("failed to add");
    assert!(add.status.success());
    let commit = Command::new("git")
        .args(["commit", "-m", "initial"])
        .current_dir(dir.path())
        .env("GIT_AUTHOR_NAME", "test")
        .env("GIT_AUTHOR_EMAIL", "test@test.com")
        .env("GIT_COMMITTER_NAME", "test")
        .env("GIT_COMMITTER_EMAIL", "test@test.com")
        .output()
        .expect("failed to commit");
    assert!(commit.status.success());

    dir
}

#[test]
fn test_head_oid() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid = repo.head_oid().expect("head oid");
    assert_eq!(oid.len(), 40);
}

#[test]
fn test_is_dirty() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    assert!(!repo.is_dirty().unwrap());

    std::fs::write(dir.path().join("new_file.txt"), b"dirty").unwrap();
    assert!(repo.is_dirty().unwrap());
}

#[test]
fn test_commit_history() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let log = git_native::commit::history::CommitHistory::get_log(&repo, 10).unwrap();
    assert!(!log.is_empty());
    assert_eq!(log[0].message, "initial");
}

#[test]
fn test_get_commit_by_oid() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid = repo.head_oid().unwrap();
    let info = git_native::commit::history::CommitHistory::get_commit_by_oid(&repo, &oid).unwrap();
    assert_eq!(info.oid, oid);
    assert_eq!(info.message, "initial");
}

#[test]
fn test_signing_not_configured() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let signed = git_native::commit::signing::CommitSigning::is_signing_configured(&repo);
    assert!(!signed);
}

#[test]
fn test_get_signing_key() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let key = git_native::commit::signing::CommitSigning::get_signing_key(&repo).unwrap();
    assert!(key.is_none());
}
