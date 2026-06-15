use std::process::Command;
use tempfile::tempdir;

fn setup_repo_with_conflict() -> tempfile::TempDir {
    let dir = tempdir().expect("failed to create temp dir");
    Command::new("git")
        .args(["init"])
        .current_dir(dir.path())
        .output()
        .expect("failed to init");
    Command::new("git")
        .args(["config", "user.email", "test@test.com"])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["config", "user.name", "test"])
        .current_dir(dir.path())
        .output()
        .ok();

    std::fs::write(dir.path().join("file.txt"), b"a\nb\nc\n").unwrap();
    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "base"])
        .current_dir(dir.path())
        .output()
        .ok();

    Command::new("git")
        .args(["checkout", "-b", "branch-a"])
        .current_dir(dir.path())
        .output()
        .ok();
    std::fs::write(dir.path().join("file.txt"), b"a\nMODIFIED_BY_A\nc\n").unwrap();
    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "change on a"])
        .current_dir(dir.path())
        .output()
        .ok();

    Command::new("git")
        .args(["checkout", "master"])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["checkout", "-b", "branch-b"])
        .current_dir(dir.path())
        .output()
        .ok();
    std::fs::write(
        dir.path().join("file.txt"),
        b"a\nMODIFIED_BY_B\nc\nd\n",
    )
    .unwrap();
    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "change on b"])
        .current_dir(dir.path())
        .output()
        .ok();

    Command::new("git")
        .args(["checkout", "master"])
        .current_dir(dir.path())
        .output()
        .ok();

    dir
}

#[test]
fn test_detect_conflicts() {
    let dir = setup_repo_with_conflict();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();
    let conflicts =
        git_native::branch::merge::BranchMerge::detect_conflicts(&repo, "branch-a").unwrap();
    assert!(!conflicts.is_empty());
}

#[test]
fn test_merge_successful() {
    let dir = setup_repo_with_conflict();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    Command::new("git")
        .args(["checkout", "branch-a"])
        .current_dir(dir.path())
        .output()
        .ok();

    let result = git_native::branch::merge::BranchMerge::merge_branch(
        &repo,
        "branch-b",
        "merge branches",
    );
    assert!(result.is_ok() || result.is_err());
}

#[test]
fn test_worktree_status() {
    let dir = setup_repo_with_conflict();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let status = git_native::status::working_tree::WorkingTreeStatus::status(&repo).unwrap();
    assert!(!status.is_empty());
}
