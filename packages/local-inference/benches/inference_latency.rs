use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn simulate_inference(prompt: &str, max_tokens: u32) -> String {
    let mut result = String::with_capacity(max_tokens as usize * 4);
    for i in 0..max_tokens {
        result.push_str("token ");
        result.push_str(&i.to_string());
        result.push(' ');
    }
    result
}

fn benchmark_inference(c: &mut Criterion) {
    let prompt = "fn fibonacci(n: u32) -> u32 {";

    c.bench_function("inference_small", |b| {
        b.iter(|| simulate_inference(black_box(prompt), black_box(128)))
    });

    c.bench_function("inference_medium", |b| {
        b.iter(|| simulate_inference(black_box(prompt), black_box(512)))
    });

    c.bench_function("inference_large", |b| {
        b.iter(|| simulate_inference(black_box(prompt), black_box(2048)))
    });
}

criterion_group!(benches, benchmark_inference);
criterion_main!(benches);
