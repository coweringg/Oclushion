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
            format!("content line 1\ncontent line 2\ncontent line 3\n"),
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

    for i in 0..50 {
        std::fs::write(
            dir.path().join(format!("file_{}.txt", i)),
            format!("modified line 1\nmodified line 2\n"),
        )
        .ok();
    }

    Command::new("git")
        .args(["add", "."])
        .current_dir(dir.path())
        .output()
        .ok();
    Command::new("git")
        .args(["commit", "-m", "second"])
        .current_dir(dir.path())
        .env("GIT_AUTHOR_NAME", "bench")
        .env("GIT_AUTHOR_EMAIL", "bench@test.com")
        .env("GIT_COMMITTER_NAME", "bench")
        .env("GIT_COMMITTER_EMAIL", "bench@test.com")
        .output()
        .ok();

    dir
}

fn bench_diff_trees(c: &mut Criterion) {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    let oid_str = repo.head_oid().unwrap();
    let new_oid =
        gix::ObjectId::from_hex(gix::validate::hex::to_byte_iter(oid_str.as_bytes()).unwrap())
            .unwrap();

    let log = git_native::commit::history::CommitHistory::get_log(&repo, 2).unwrap();
    let old_oid_str = &log[1].oid;
    let old_oid =
        gix::ObjectId::from_hex(gix::validate::hex::to_byte_iter(old_oid_str.as_bytes()).unwrap())
            .unwrap();

    c.bench_function("diff_trees", |b| {
        b.iter(|| {
            let result =
                git_native::diff::in_memory::InMemoryDiff::diff_trees(
                    black_box(&repo),
                    black_box(old_oid),
                    black_box(new_oid),
                );
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_diff_trees);
criterion_main!(benches);
