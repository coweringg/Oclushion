use hive_memory::*;
use hive_memory::db::connection::Database;
use hive_memory::embedding::onnx_runtime::OnnxRuntime;
use hive_memory::lifecycle::ingestion::IngestionPipeline;
use hive_memory::lifecycle::deduplication::Deduplication;
use uuid::Uuid;

fn make_insight(text: &str, confidence: f32) -> Insight {
    let now = chrono::Utc::now();
    Insight {
        id: Uuid::now_v7(),
        vector: Vec::new(),
        text: text.to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence,
        tags: vec!["test".to_string()],
        created_at: now,
        expires_at: now + chrono::Duration::days(30),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    }
}

#[test]
fn test_ingestion_pipeline() {
    let db = Database::new(":memory:");
    let embedding = OnnxRuntime::load_model("test-model");
    let insight = make_insight("test insight", 0.9);
    IngestionPipeline::ingest(&db, &embedding, insight).unwrap();
    assert_eq!(db.insight_count(), 1);
}

#[test]
fn test_ingestion_fills_vector() {
    let db = Database::new(":memory:");
    let embedding = OnnxRuntime::load_model("test-model");
    let insight = make_insight("vector test", 0.8);
    IngestionPipeline::ingest(&db, &embedding, insight).unwrap();
    let stored = db.all_insights();
    assert_eq!(stored[0].vector.len(), 384);
}

#[test]
fn test_ingestion_sets_expiry() {
    let db = Database::new(":memory:");
    let embedding = OnnxRuntime::load_model("test-model");
    let now = chrono::Utc::now();
    let mut insight = make_insight("expiry test", 0.5);
    insight.expires_at = now;
    insight.created_at = now;
    IngestionPipeline::ingest(&db, &embedding, insight).unwrap();
    let stored = db.all_insights();
    assert!(stored[0].expires_at > now);
}

#[test]
fn test_auto_dedup() {
    let db = Database::new(":memory:");
    let embedding = OnnxRuntime::load_model("test-model");
    let insight1 = make_insight("hello world", 0.9);
    IngestionPipeline::ingest(&db, &embedding, insight1).unwrap();
    let dup = IngestionPipeline::auto_deduplicate(
        &db,
        &embedding,
        &make_insight("hello world", 0.9),
        0.95,
    )
    .unwrap();
    assert!(dup.is_some());
}

#[test]
fn test_auto_dedup_no_match() {
    let db = Database::new(":memory:");
    let embedding = OnnxRuntime::load_model("test-model");
    let insight = make_insight("unique content", 0.9);
    IngestionPipeline::ingest(&db, &embedding, insight).unwrap();
    let dup = IngestionPipeline::auto_deduplicate(
        &db,
        &embedding,
        &make_insight("completely different", 0.9),
        0.95,
    )
    .unwrap();
    assert!(dup.is_none());
}

#[test]
fn test_dedup_find_and_merge() {
    let db = Database::new(":memory:");
    let insight = make_insight("unique", 0.9);
    IngestionPipeline::ingest(
        &db,
        &OnnxRuntime::load_model(""),
        insight.clone(),
    )
    .unwrap();
    let dups = Deduplication::find_duplicates(&db, &insight, 0.5).unwrap();
    assert!(dups.is_empty());
}
