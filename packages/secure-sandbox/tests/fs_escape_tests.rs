use secure_sandbox::security::FsJail;
use secure_sandbox::{SandboxErrorKind};
use std::path::PathBuf;

#[test]
fn test_path_traversal_detection() {
    let jail = FsJail::new(
        PathBuf::from("/tmp/project"),
        PathBuf::from("/tmp/sandbox"),
    );

    let result = jail.resolve_path("../../../etc/passwd");
    assert!(result.is_err(), "path traversal should be denied");
    if let Err(err) = result {
        assert_eq!(err.kind, SandboxErrorKind::FsAccessDenied);
        assert!(
            err.message.contains("traversal"),
            "message should mention traversal: {}",
            err.message
        );
    }
}

#[test]
fn test_path_with_root_outside_jail() {
    let jail = FsJail::new(
        PathBuf::from("/tmp/project"),
        PathBuf::from("/tmp/sandbox"),
    );

    let result = jail.resolve_path("/etc/passwd");
    assert!(result.is_err(), "path outside jail should be denied");
    if let Err(err) = result {
        assert_eq!(err.kind, SandboxErrorKind::FsAccessDenied);
    }
}

#[test]
fn test_jail_initialization() {
    let jail = FsJail::new(
        PathBuf::from("/tmp/project"),
        PathBuf::from("/tmp/sandbox"),
    );

    assert_eq!(jail.is_path_allowed(&PathBuf::from("/tmp/project/subdir"), false), true);
    assert_eq!(jail.is_path_allowed(&PathBuf::from("/tmp/other"), false), false);
}

#[test]
fn test_jail_write_allowed_only_in_temp() {
    let jail = FsJail::new(
        PathBuf::from("/tmp/project"),
        PathBuf::from("/tmp/sandbox"),
    );

    assert_eq!(jail.is_path_allowed(&PathBuf::from("/tmp/sandbox/file.txt"), true), true);
    assert_eq!(jail.is_path_allowed(&PathBuf::from("/tmp/project/file.txt"), true), false);
}
