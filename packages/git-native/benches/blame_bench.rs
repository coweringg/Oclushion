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

    let content: String = (0..500)
        .map(|i| format!("line {}: this is some content for benchmarking\n", i))
        .collect();

    std::fs::write(dir.path().join("large_file.txt"), &content).ok();

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

    dir
}

fn bench_blame_file(c: &mut Criterion) {
    let dir = setup_repo();
    let repo = git_native::repository::Repository::open(dir.path()).unwrap();

    c.bench_function("blame_file", |b| {
        b.iter(|| {
            let result = git_native::blame::line_blame::LineBlame::blame_file(
                black_box(&repo),
                black_box("large_file.txt"),
            );
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_blame_file);
criterion_main!(benches);
