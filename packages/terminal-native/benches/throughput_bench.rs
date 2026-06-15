use criterion::{criterion_group, criterion_main, Criterion};

fn throughput_bench(c: &mut Criterion) {
    c.bench_function("throughput", |b| {
        b.iter(|| {
            let mut buf = vec![0u8; 65536];
            for i in 0..buf.len() {
                buf[i] = (i & 0xff) as u8;
            }
            buf.len()
        })
    });
}

criterion_group!(benches, throughput_bench);
criterion_main!(benches);
