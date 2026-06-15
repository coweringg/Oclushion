use criterion::{criterion_group, criterion_main, Criterion};

fn latency_bench(c: &mut Criterion) {
    c.bench_function("latency", |b| {
        b.iter(|| {
            std::hint::black_box(42 + 1)
        })
    });
}

criterion_group!(benches, latency_bench);
criterion_main!(benches);
