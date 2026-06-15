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

    std::fs::write(dir.path().join("file1.txt"), b"line1\nline2\nline3\n")
        .expect("failed to write file");
    std::fs::write(dir.path().join("file2.txt"), b"content a\ncontent b\n")
        .expect("failed to write file");

    let add = Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .expect("failed to add");
    assert!(add.status.success());

    let commit = Command::new("git")
        .args(["commit", "-m", "initial commit"])
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
fn test_diff_trees() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let head_oid = repo.head_oid().expect("head oid");
    assert!(!head_oid.is_empty());
    assert_eq!(head_oid.len(), 40);
}

#[test]
fn test_head_short_sha() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let short = repo.head_short_sha().expect("short sha");
    assert_eq!(short.len(), 7);
}

#[test]
fn test_repo_path() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let git_dir = repo.repo_path();
    assert!(git_dir.ends_with(".git") || git_dir.ends_with(".git\\"));
}

#[test]
fn test_open_from_env() {
    let dir = setup_repo();
    std::env::set_var("GIT_DIR", dir.path().join(".git"));
    let result = git_native::repository::Repository::open_from_env();
    std::env::remove_var("GIT_DIR");
    assert!(result.is_ok());
}

#[test]
fn test_diff_formatter_unified() {
    use git_native::{DiffEntry, DiffHunk};

    let entries = vec![DiffEntry {
        file: "test.txt".to_string(),
        status: "modified".to_string(),
        added_lines: 2,
        removed_lines: 1,
        hunks: vec![DiffHunk {
            header: String::new(),
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            content: "-old line\n+new line\n+another line\n".to_string(),
        }],
    }];

    let formatted = git_native::diff::formatter::DiffFormatter::format_as_unified(&entries);
    assert!(formatted.contains("--- a/test.txt"));
    assert!(formatted.contains("+++ b/test.txt"));
    assert!(formatted.contains("@@ -1,3 +1,4 @@"));
}

#[test]
fn test_diff_formatter_json() {
    use git_native::DiffEntry;

    let entries = vec![DiffEntry {
        file: "test.txt".to_string(),
        status: "added".to_string(),
        added_lines: 1,
        removed_lines: 0,
        hunks: Vec::new(),
    }];

    let json = git_native::diff::formatter::DiffFormatter::format_as_json(&entries);
    assert!(json.is_array());
    assert_eq!(json.as_array().unwrap().len(), 1);
}

#[test]
fn test_diff_formatter_safediff() {
    use git_native::{DiffEntry, DiffHunk};

    let entries = vec![DiffEntry {
        file: "test.txt".to_string(),
        status: "modified".to_string(),
        added_lines: 0,
        removed_lines: 0,
        hunks: vec![DiffHunk {
            header: String::new(),
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            content: "-old\n+new\n".to_string(),
        }],
    }];

    let safe = git_native::diff::formatter::DiffFormatter::format_as_safediff(&entries);
    assert!(safe.is_array());
}
