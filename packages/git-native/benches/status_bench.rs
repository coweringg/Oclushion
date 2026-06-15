use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::process::Command;
use tempfile::tempdir;

fn setup_repo() -> tempfile::TempDir {
    let dir = tempdir().expect("failed to create temp dir");
    Command::new("git")
        .args(["init"])
        .current_dir(dir.path())
        .output()
        .ok();

    for i in 0..100 {
        std::fs::write(
            dir.path().join(format!("file_{}.txt", i)),
            format!("content line {}\n", i),
        )
        .ok();
    }

    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "initial"])
        .current_dir(dir.path())
        .env("GIT_AUTHOR_NAME", "bench")
        .env("GIT_AUTHOR_EMAIL", "bench@test.com")
        .env("GIT_COMMITTER_NAME", "bench")
        .env("GIT_COMMITTER_EMAIL", "bench@test.com")
        .output()
        .ok();

    for i in 0..10 {
        std::fs::write(
            dir.path().join(format!("file_{}.txt", i)),
            format!("modified content {}\n", i),
        )
        .ok();
    }

    dir
}

fn bench_working_tree_status(c: &mut Criterion) {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    c.bench_function("status_working_tree", |b| {
        b.iter(|| {
            let result =
                git_native::status::working_tree::WorkingTreeStatus::status(black_box(&repo));
            black_box(result)
        })
    });
}

fn bench_staged_status(c: &mut Criterion) {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    c.bench_function("status_staged", |b| {
        b.iter(|| {
            let result = git_native::status::staged::StagedStatus::staged_files(black_box(&repo));
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_working_tree_status, bench_staged_status);
criterion_main!(benches);
