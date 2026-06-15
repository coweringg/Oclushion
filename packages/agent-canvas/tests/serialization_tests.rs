use agent_canvas::serialization::export::{WorkflowDocument, to_json, to_json_pretty, SerializableNode, SerializableEdge};
use agent_canvas::serialization::import::{import_workflow, import_workflow_unchecked};
use agent_canvas::serialization::schema::WorkflowSchema;
use agent_canvas::serialization::versioning;
use agent_canvas::serialization::WorkflowMetadata;

fn create_test_document() -> WorkflowDocument {
    let nodes = vec![
        SerializableNode {
            id: "11111111-1111-1111-1111-111111111111".to_string(),
            node_type: "Agent".to_string(),
            config: serde_json::json!({"role": "Builder"}),
            position: vec![100.0, 100.0],
            ports: vec![],
        },
        SerializableNode {
            id: "22222222-2222-2222-2222-222222222222".to_string(),
            node_type: "Agent".to_string(),
            config: serde_json::json!({"role": "Reviewer"}),
            position: vec![300.0, 100.0],
            ports: vec![],
        },
    ];

    let edges = vec![
        SerializableEdge {
            id: "33333333-3333-3333-3333-333333333333".to_string(),
            source_node: "11111111-1111-1111-1111-111111111111".to_string(),
            source_port: "00000000-0000-0000-0000-000000000000".to_string(),
            target_node: "22222222-2222-2222-2222-222222222222".to_string(),
            target_port: "00000000-0000-0000-0000-000000000000".to_string(),
        },
    ];

    let metadata = WorkflowMetadata::new(
        "tester".to_string(),
        vec!["test".to_string()],
        "Test workflow".to_string(),
        "1.0.0".to_string(),
    );

    WorkflowDocument::new(1, metadata, nodes, edges)
}

#[test]
fn test_round_trip_serialization() {
    let doc = create_test_document();
    let json = to_json(&doc).unwrap();
    let imported = import_workflow(&json, 1).unwrap();

    assert_eq!(imported.version, doc.version);
    assert_eq!(imported.nodes.len(), doc.nodes.len());
    assert_eq!(imported.edges.len(), doc.edges.len());
    assert_eq!(imported.nodes[0].node_type, "Agent");
    assert_eq!(imported.nodes[0].config["role"], "Builder");
}

#[test]
fn test_pretty_json() {
    let doc = create_test_document();
    let json = to_json_pretty(&doc).unwrap();
    assert!(json.contains('\n'));
}

#[test]
fn test_import_invalid_json() {
    let result = import_workflow("not valid json", 1);
    assert!(result.is_err());
}

#[test]
fn test_import_empty_nodes() {
    let json = r#"{
        "version": 1,
        "metadata": {"author":"test","tags":[],"description":"","version":"1.0.0"},
        "nodes": [],
        "edges": [],
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
    }"#;
    let result = import_workflow(json, 1);
    assert!(result.is_err());
}

#[test]
fn test_schema_validation_passes() {
    let doc = create_test_document();
    let result = WorkflowSchema::validate(&doc);
    assert!(result.is_ok());
}

#[test]
fn test_schema_rejects_version_zero() {
    let mut doc = create_test_document();
    doc.version = 0;
    let result = WorkflowSchema::validate(&doc);
    assert!(result.is_err());
}

#[test]
fn test_version_migration_same_version() {
    let doc = create_test_document();
    let result = versioning::migrate(doc, 1, 1);
    assert!(result.is_ok());
}

#[test]
fn test_version_check() {
    let doc = create_test_document();
    let result = versioning::check_version(&doc);
    assert!(result.is_ok());
}

#[test]
fn test_dag_conversion() {
    let doc = create_test_document();
    let dag = doc.to_dag().unwrap();
    assert_eq!(dag.node_count(), 2);
    assert_eq!(dag.edge_count(), 1);
}

#[test]
fn test_import_unchecked() {
    let doc = create_test_document();
    let json = to_json(&doc).unwrap();
    let result = import_workflow_unchecked(&json);
    assert!(result.is_ok());
}

#[test]
fn test_version_mismatch_error() {
    let mut doc = create_test_document();
    doc.version = 999;
    let json = to_json(&doc).unwrap();
    let result = import_workflow(&json, 1);
    assert!(result.is_err());
}

#[test]
fn test_generate_json_schema() {
    let schema = WorkflowSchema::generate_json_schema();
    assert_eq!(schema["title"], "AgentCanvas Workflow");
    assert!(schema["properties"]["nodes"].is_object());
    assert!(schema["properties"]["edges"].is_object());
}
