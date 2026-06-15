use std::path::Path;
use std::time::Duration;

use criterion::{criterion_group, criterion_main, Criterion};

fn bench_incremental_reparse(c: &mut Criterion) {
    let dir = tempfile::tempdir().unwrap();

    let mut files = Vec::new();
    for i in 0..100 {
        let content = format!("export const val{} = {};", i, i);
        let path = dir.path().join(format!("mod_{}.ts", i));
        std::fs::write(&path, &content).unwrap();
        files.push(path);
    }

    let parser = code_intelligence::parser::incremental::IncrementalParser::new();

    for f in &files {
        let _ = parser.parse_file(f);
    }

    c.bench_function("incremental_reparse_1_file", |b| {
        b.iter(|| {
            std::fs::write(&files[0], "const modified = true;").unwrap();
            let _ = parser.parse_file(&files[0]);
        });
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default().sample_size(10).measurement_time(Duration::from_secs(5));
    targets = bench_incremental_reparse
}
criterion_main!(benches);
