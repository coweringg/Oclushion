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
fn test_create_branch() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid_str = repo.head_oid().unwrap();
    let oid = gix::ObjectId::from_hex(oid_str.as_bytes())
    .unwrap();
    let result = git_native::branch::create::BranchCreate::create_branch(&repo, "test-branch", oid);
    assert!(result.is_ok());
}

#[test]
fn test_create_branch_from_head() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let result =
        git_native::branch::create::BranchCreate::create_branch_from_head(&repo, "feature-branch");
    assert!(result.is_ok());
}

#[test]
fn test_delete_branch() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid_str = repo.head_oid().unwrap();
    let oid = gix::ObjectId::from_hex(oid_str.as_bytes())
    .unwrap();

    git_native::branch::create::BranchCreate::create_branch(&repo, "to-delete", oid).unwrap();
    let result = git_native::branch::delete::BranchDelete::delete_branch(&repo, "to-delete");
    assert!(result.is_ok());
}

#[test]
fn test_checkout_branch() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid_str = repo.head_oid().unwrap();
    let oid = gix::ObjectId::from_hex(oid_str.as_bytes())
    .unwrap();

    git_native::branch::create::BranchCreate::create_branch(&repo, "other", oid).unwrap();
    let result = git_native::branch::switch::BranchSwitch::checkout_branch(&repo, "other");
    assert!(result.is_ok());
}

#[test]
fn test_delete_agent_branches() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let oid_str = repo.head_oid().unwrap();
    let oid = gix::ObjectId::from_hex(oid_str.as_bytes())
    .unwrap();

    let _ = git_native::branch::create::BranchCreate::create_branch(
        &repo,
        "oclushion/agent/session-1",
        oid,
    );
    let _ = git_native::branch::create::BranchCreate::create_branch(
        &repo,
        "oclushion/agent/session-2",
        oid,
    );

    let deleted = git_native::branch::delete::BranchDelete::delete_agent_branches(&repo).unwrap();
    assert_eq!(deleted.len(), 2);
}
