use criterion::{black_box, criterion_group, criterion_main, Criterion};

struct ThroughputSimulator {
    tokens_per_second: f64,
}

impl ThroughputSimulator {
    fn new(tps: f64) -> Self {
        Self { tokens_per_second: tps }
    }

    fn generate_tokens(&self, count: u32) -> Vec<String> {
        let mut tokens = Vec::with_capacity(count as usize);
        for i in 0..count {
            tokens.push(format!("token_{}", i));
        }
        tokens
    }
}

fn benchmark_throughput(c: &mut Criterion) {
    let sim = ThroughputSimulator::new(30.0);
    let tokens_100 = black_box(100u32);
    let tokens_500 = black_box(500u32);
    let tokens_1000 = black_box(1000u32);

    c.bench_function("throughput_100_tokens", |b| {
        b.iter(|| sim.generate_tokens(tokens_100))
    });

    c.bench_function("throughput_500_tokens", |b| {
        b.iter(|| sim.generate_tokens(tokens_500))
    });

    c.bench_function("throughput_1000_tokens", |b| {
        b.iter(|| sim.generate_tokens(tokens_1000))
    });
}

criterion_group!(benches, benchmark_throughput);
criterion_main!(benches);
