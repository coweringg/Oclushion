use hive_memory::*;
use hive_memory::db::connection::Database;
use hive_memory::embedding::onnx_runtime::OnnxRuntime;
use hive_memory::search::vector_search::VectorSearch;
use hive_memory::search::hybrid_search::HybridSearch;
use hive_memory::search::filters::SearchFilters;
use uuid::Uuid;

fn make_insight(text: &str, tags: Vec<String>) -> Insight {
    let now = chrono::Utc::now();
    let embedding = OnnxRuntime::load_model("");
    let vector = embedding.embed(text).unwrap();
    Insight {
        id: Uuid::now_v7(),
        vector,
        text: text.to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.9,
        tags,
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    }
}

#[test]
fn test_vector_search_returns_results() {
    let db = Database::new(":memory:");
    db.insert(make_insight(
        "rust programming",
        vec!["tech".to_string()],
    ))
    .unwrap();
    db.insert(make_insight(
        "cooking pasta",
        vec!["food".to_string()],
    ))
    .unwrap();

    let query_vec = OnnxRuntime::load_model("").embed("rust code").unwrap();
    let results = VectorSearch::search_by_vector(&db, &query_vec, 5).unwrap();
    assert!(!results.is_empty());
    assert!(results[0].score > 0.0);
}

#[test]
fn test_vector_search_with_k() {
    let db = Database::new(":memory:");
    for i in 0..10 {
        db.insert(make_insight(
            &format!("item {}", i),
            vec!["test".to_string()],
        ))
        .unwrap();
    }
    let query_vec = OnnxRuntime::load_model("").embed("item").unwrap();
    let results = VectorSearch::search_by_vector(&db, &query_vec, 3).unwrap();
    assert_eq!(results.len(), 3);
}

#[test]
fn test_vector_search_empty_query() {
    let db = Database::new(":memory:");
    let result = VectorSearch::search_by_vector(&db, &[], 5);
    assert!(result.is_err());
}

#[test]
fn test_hybrid_search_returns_results() {
    let db = Database::new(":memory:");
    db.insert(make_insight(
        "machine learning is fun",
        vec!["ai".to_string()],
    ))
    .unwrap();
    db.insert(make_insight(
        "i love learning new things",
        vec!["education".to_string()],
    ))
    .unwrap();

    let results = HybridSearch::search(&db, "learning", 5).unwrap();
    assert!(!results.is_empty());
}

#[test]
fn test_hybrid_search_empty_db() {
    let db = Database::new(":memory:");
    let results = HybridSearch::search(&db, "anything", 5).unwrap();
    assert!(results.is_empty());
}

#[test]
fn test_search_filters() {
    let db = Database::new(":memory:");
    db.insert(make_insight(
        "public insight",
        vec!["public".to_string()],
    ))
    .unwrap();

    let filtered = SearchFilters::new()
        .with_min_confidence(0.5)
        .apply(db.all_insights());
    assert_eq!(filtered.len(), 1);

    let none = SearchFilters::new()
        .with_min_confidence(0.95)
        .apply(db.all_insights());
    assert_eq!(none.len(), 0);
}

#[test]
fn test_search_filters_exclude_project() {
    let db = Database::new(":memory:");
    db.insert(make_insight(
        "project a insight",
        vec!["a".to_string()],
    ))
    .unwrap();

    let filtered = SearchFilters::new()
        .exclude_project("other")
        .apply(db.all_insights());
    assert_eq!(filtered.len(), 1);
}

#[test]
fn test_search_filters_tags() {
    let db = Database::new(":memory:");
    db.insert(make_insight(
        "tagged insight",
        vec!["important".to_string(), "urgent".to_string()],
    ))
    .unwrap();

    let filtered = SearchFilters::new()
        .with_tags(vec!["important".to_string()])
        .apply(db.all_insights());
    assert_eq!(filtered.len(), 1);

    let none = SearchFilters::new()
        .with_tags(vec!["missing".to_string()])
        .apply(db.all_insights());
    assert_eq!(none.len(), 0);
}
