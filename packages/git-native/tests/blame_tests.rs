use std::process::Command;
use tempfile::tempdir;

fn setup_repo() -> tempfile::TempDir {
    let dir = tempdir().expect("failed to create temp dir");
    Command::new("git")
        .args(["init"])
        .current_dir(dir.path())
        .output()
        .expect("failed to init repo");

    std::fs::write(dir.path().join("main.rs"), b"fn main() {\n    println!(\"hello\");\n}\n")
        .expect("failed to write");

    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "initial"])
        .current_dir(dir.path())
        .env("GIT_AUTHOR_NAME", "test")
        .env("GIT_AUTHOR_EMAIL", "test@test.com")
        .env("GIT_COMMITTER_NAME", "test")
        .env("GIT_COMMITTER_EMAIL", "test@test.com")
        .output()
        .ok();

    dir
}

#[test]
fn test_blame_file() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let lines = git_native::blame::line_blame::LineBlame::blame_file(&repo, "main.rs").unwrap();
    assert!(!lines.is_empty());
    assert_eq!(lines.len(), 3);
    assert_eq!(lines[0].line_number, 1);
    assert_eq!(lines[0].content, "fn main() {");
}

#[test]
fn test_blame_file_not_found() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let result = git_native::blame::line_blame::LineBlame::blame_file(&repo, "nonexistent.rs");
    assert!(result.is_err());
}

#[test]
fn test_blame_line_content() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let lines = git_native::blame::line_blame::LineBlame::blame_file(&repo, "main.rs").unwrap();
    let line2 = &lines[1];
    assert_eq!(line2.line_number, 2);
    assert_eq!(line2.content, "    println!(\"hello\");");
    assert!(!line2.commit_oid.is_empty());
}

#[test]
fn test_blame_serialize() {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let lines = git_native::blame::line_blame::LineBlame::blame_file(&repo, "main.rs").unwrap();
    let json = serde_json::to_string(&lines).unwrap();
    assert!(json.contains("line_number"));
    assert!(json.contains("commit_oid"));
}
