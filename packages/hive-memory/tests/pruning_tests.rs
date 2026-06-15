use hive_memory::*;
use hive_memory::db::connection::Database;
use hive_memory::lifecycle::pruning::Pruning;
use hive_memory::lifecycle::ttl::TtlManager;
use uuid::Uuid;

#[test]
fn test_ttl_low_confidence() {
    let ttl = TtlManager::get_ttl(0.5);
    assert_eq!(ttl.as_secs(), 30 * 24 * 60 * 60);
}

#[test]
fn test_ttl_medium_confidence() {
    let ttl = TtlManager::get_ttl(0.75);
    assert_eq!(ttl.as_secs(), 90 * 24 * 60 * 60);
}

#[test]
fn test_ttl_high_confidence() {
    let ttl = TtlManager::get_ttl(0.9);
    assert_eq!(ttl.as_secs(), 365 * 24 * 60 * 60);
}

#[test]
fn test_prune_expired() {
    let db = Database::new(":memory:");
    let now = chrono::Utc::now();

    let expired = Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: "expired".to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.5,
        tags: vec![],
        created_at: now - chrono::Duration::days(100),
        expires_at: now - chrono::Duration::days(1),
        agent_role: "tester".to_string(),
        outcome: "fail".to_string(),
    };
    db.insert(expired).unwrap();

    let active = Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: "active".to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };
    db.insert(active).unwrap();

    let count = Pruning::prune_expired(&db).unwrap();
    assert_eq!(count, 1);
    assert_eq!(db.insight_count(), 1);
}

#[test]
fn test_prune_low_confidence() {
    let db = Database::new(":memory:");
    let now = chrono::Utc::now();

    let low = Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: "low confidence".to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.3,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(30),
        agent_role: "tester".to_string(),
        outcome: "fail".to_string(),
    };
    db.insert(low).unwrap();

    let high = Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: "high confidence".to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };
    db.insert(high).unwrap();

    let count = Pruning::prune_low_confidence(&db, 0.5).unwrap();
    assert_eq!(count, 1);
    assert_eq!(db.insight_count(), 1);
}

#[test]
fn test_prune_nothing_to_prune() {
    let db = Database::new(":memory:");
    let now = chrono::Utc::now();
    let active = Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: "active".to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };
    db.insert(active).unwrap();

    assert_eq!(Pruning::prune_expired(&db).unwrap(), 0);
    assert_eq!(Pruning::prune_low_confidence(&db, 0.5).unwrap(), 0);
}
