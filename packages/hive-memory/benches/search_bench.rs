use criterion::{black_box, criterion_group, criterion_main, Criterion};
use hive_memory::db::connection::Database;
use hive_memory::embedding::onnx_runtime::OnnxRuntime;
use hive_memory::search::vector_search::VectorSearch;
use hive_memory::search::hybrid_search::HybridSearch;
use uuid::Uuid;

fn make_insight(text: &str) -> hive_memory::Insight {
    let embedding = OnnxRuntime::load_model("");
    let vector = embedding.embed(text).unwrap();
    let now = chrono::Utc::now();
    hive_memory::Insight {
        id: Uuid::now_v7(),
        vector,
        text: text.to_string(),
        source_project: "bench".to_string(),
        author: "bench".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "bench".to_string(),
        outcome: "success".to_string(),
    }
}

fn bench_vector_search(c: &mut Criterion) {
    let db = Database::new(":memory:");
    for i in 0..100 {
        let insight = make_insight(&format!("insight number {}", i));
        db.insert(insight).unwrap();
    }
    let query_vec = OnnxRuntime::load_model("").embed("benchmark query").unwrap();

    c.bench_function("vector_search_100", |b| {
        b.iter(|| {
            VectorSearch::search_by_vector(
                black_box(&db),
                black_box(&query_vec),
                black_box(10),
            )
        })
    });
}

fn bench_hybrid_search(c: &mut Criterion) {
    let db = Database::new(":memory:");
    for i in 0..100 {
        let insight = make_insight(&format!("insight number {} with some text", i));
        db.insert(insight).unwrap();
    }

    c.bench_function("hybrid_search_100", |b| {
        b.iter(|| HybridSearch::search(black_box(&db), black_box("benchmark query"), black_box(10)))
    });
}

criterion_group!(benches, bench_vector_search, bench_hybrid_search);
criterion_main!(benches);
