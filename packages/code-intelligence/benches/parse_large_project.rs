use std::path::Path;
use std::time::Duration;

use criterion::{criterion_group, criterion_main, Criterion};

fn create_large_project(file_count: usize) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    for i in 0..file_count {
        let content = format!(
            r#"
export function func{i}(a: number, b: number): number {{
    if (a > b) {{
        return a;
    }}
    return b;
}}

export class Class{i} {{
    private value: number = {i};
    public getValue(): number {{
        return this.value;
    }}
}}
"#
        );
        let file_path = dir.path().join(format!("module_{}.ts", i));
        std::fs::write(&file_path, &content).unwrap();
    }
    dir
}

fn bench_parse_large_project(c: &mut Criterion) {
    let dir = create_large_project(1000);
    let parser = code_intelligence::parser::incremental::IncrementalParser::new();

    c.bench_function("parse_large_project_1000_files", |b| {
        b.iter(|| {
            for entry in std::fs::read_dir(dir.path()).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if path.extension().map(|e| e == "ts").unwrap_or(false) {
                    let _ = parser.parse_file(&path);
                }
            }
        });
    });
}

fn bench_incremental_reparse(c: &mut Criterion) {
    let dir = create_large_project(100);
    let parser = code_intelligence::parser::incremental::IncrementalParser::new();

    let files: Vec<_> = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "ts").unwrap_or(false))
        .collect();

    for f in &files {
        let _ = parser.parse_file(f);
    }

    c.bench_function("incremental_reparse_single_file", |b| {
        b.iter(|| {
            let target = &files[0];
            std::fs::write(target, "const modified = true;").unwrap();
            let _ = parser.parse_file(target);
        });
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default().sample_size(10).measurement_time(Duration::from_secs(5));
    targets = bench_parse_large_project, bench_incremental_reparse
}
criterion_main!(benches);
