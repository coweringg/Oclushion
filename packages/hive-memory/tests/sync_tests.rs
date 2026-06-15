use hive_memory::*;
use hive_memory::db::connection::Database;
use hive_memory::sync::export::SyncExport;
use hive_memory::sync::import::SyncImport;
use hive_memory::sync::conflict_resolution::{ConflictResolution, ConflictResolver};
use uuid::Uuid;

fn make_insight(text: &str) -> Insight {
    let now = chrono::Utc::now();
    Insight {
        id: Uuid::now_v7(),
        vector: vec![],
        text: text.to_string(),
        source_project: "test".to_string(),
        author: "tester".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    }
}

#[test]
fn test_export_import_roundtrip() {
    let db = Database::new(":memory:");
    let insight = make_insight("test roundtrip");
    db.insert(insight).unwrap();

    let exported = SyncExport::export_all(&db).unwrap();
    assert!(!exported.is_empty());

    let db2 = Database::new(":memory:");
    let count =
        SyncImport::import_insights(&db2, &exported, ConflictResolution::LastWriteWins).unwrap();
    assert_eq!(count, 1);
    assert_eq!(db2.insight_count(), 1);
}

#[test]
fn test_export_new_since() {
    let db = Database::new(":memory:");
    let old = make_insight("old insight");
    db.insert(old).unwrap();

    let since = chrono::Utc::now() + chrono::Duration::hours(1);
    let exported = SyncExport::export_new_insights(&db, since).unwrap();
    let insights: Vec<Insight> = serde_json::from_slice(&exported).unwrap();
    assert!(insights.is_empty());
}

#[test]
fn test_export_batch_and_reimport() {
    let db = Database::new(":memory:");
    for i in 0..5 {
        db.insert(make_insight(&format!("insight {}", i)))
            .unwrap();
    }

    let exported = SyncExport::export_all(&db).unwrap();
    let exported_size = exported.len();

    let db2 = Database::new(":memory:");
    let count =
        SyncImport::import_insights(&db2, &exported, ConflictResolution::LastWriteWins).unwrap();
    assert_eq!(count, 5);
    assert_eq!(db2.insight_count(), 5);

    let exported2 = SyncExport::export_all(&db2).unwrap();
    assert_eq!(exported2.len(), exported_size);
}

#[test]
fn test_conflict_last_write_wins() {
    let now = chrono::Utc::now();
    let id = Uuid::now_v7();

    let old = Insight {
        id,
        vector: vec![],
        text: "old version".to_string(),
        source_project: "test".to_string(),
        author: "alice".to_string(),
        confidence: 0.5,
        tags: vec!["old".to_string()],
        created_at: now - chrono::Duration::hours(2),
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "fail".to_string(),
    };

    let new = Insight {
        id,
        vector: vec![],
        text: "new version".to_string(),
        source_project: "test".to_string(),
        author: "bob".to_string(),
        confidence: 0.9,
        tags: vec!["new".to_string()],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };

    let resolved = ConflictResolver::resolve(&old, &new, ConflictResolution::LastWriteWins);
    assert_eq!(resolved.text, "new version");
}

#[test]
fn test_conflict_highest_confidence_wins() {
    let now = chrono::Utc::now();
    let id = Uuid::now_v7();

    let old = Insight {
        id,
        vector: vec![],
        text: "low confidence".to_string(),
        source_project: "test".to_string(),
        author: "alice".to_string(),
        confidence: 0.3,
        tags: vec![],
        created_at: now - chrono::Duration::hours(2),
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "fail".to_string(),
    };

    let new = Insight {
        id,
        vector: vec![],
        text: "high confidence".to_string(),
        source_project: "test".to_string(),
        author: "bob".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };

    let resolved =
        ConflictResolver::resolve(&old, &new, ConflictResolution::HighestConfidenceWins);
    assert_eq!(resolved.text, "high confidence");
}

#[test]
fn test_resolve_conflict_default() {
    let now = chrono::Utc::now();
    let id = Uuid::now_v7();
    let old = Insight {
        id,
        vector: vec![],
        text: "old".to_string(),
        source_project: "test".to_string(),
        author: "alice".to_string(),
        confidence: 0.5,
        tags: vec![],
        created_at: now - chrono::Duration::hours(2),
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "fail".to_string(),
    };
    let new = Insight {
        id,
        vector: vec![],
        text: "new".to_string(),
        source_project: "test".to_string(),
        author: "bob".to_string(),
        confidence: 0.9,
        tags: vec![],
        created_at: now,
        expires_at: now + chrono::Duration::days(365),
        agent_role: "tester".to_string(),
        outcome: "success".to_string(),
    };
    let resolved = SyncImport::resolve_conflict(&old, &new);
    assert_eq!(resolved.text, "new");
}
