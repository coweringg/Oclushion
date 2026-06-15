use agent_canvas::presets::{list_presets, load_preset};

#[test]
fn test_list_presets() {
    let presets = list_presets();
    assert!(!presets.is_empty());
    assert!(presets.iter().any(|p| p.name == "default_pipeline"));
    assert!(presets.iter().any(|p| p.name == "security_focused"));
    assert!(presets.iter().any(|p| p.name == "rapid_prototype"));
}

#[test]
fn test_load_default_pipeline() {
    let doc = load_preset("default_pipeline").unwrap();
    assert_eq!(doc.version, 1);
    assert_eq!(doc.nodes.len(), 5);
    assert_eq!(doc.edges.len(), 4);
    assert!(doc.metadata.tags.contains(&"default".to_string()));
}

#[test]
fn test_load_security_focused() {
    let doc = load_preset("security_focused").unwrap();
    assert_eq!(doc.nodes.len(), 5);
    assert_eq!(doc.edges.len(), 4);
    assert!(doc.metadata.tags.contains(&"security".to_string()));
}

#[test]
fn test_load_rapid_prototype() {
    let doc = load_preset("rapid_prototype").unwrap();
    assert_eq!(doc.nodes.len(), 2);
    assert_eq!(doc.edges.len(), 1);
}

#[test]
fn test_load_nonexistent_preset() {
    let result = load_preset("nonexistent");
    assert!(result.is_err());
}

#[test]
fn test_preset_node_types() {
    let doc = load_preset("default_pipeline").unwrap();
    for node in &doc.nodes {
        assert_eq!(node.node_type, "Agent");
    }
}

#[test]
fn test_preset_edges_reference_valid_nodes() {
    let doc = load_preset("default_pipeline").unwrap();
    for edge in &doc.edges {
        let src_exists = doc.nodes.iter().any(|n| n.id == edge.source_node);
        let tgt_exists = doc.nodes.iter().any(|n| n.id == edge.target_node);
        assert!(src_exists, "Edge source {} not found in nodes", edge.source_node);
        assert!(tgt_exists, "Edge target {} not found in nodes", edge.target_node);
    }
}

#[test]
fn test_preset_to_dag() {
    let doc = load_preset("default_pipeline").unwrap();
    let dag = doc.to_dag().unwrap();
    assert_eq!(dag.node_count(), doc.nodes.len());
    assert_eq!(dag.edge_count(), doc.edges.len());
    assert!(!dag.has_cycle());
}

#[test]
fn test_all_presets_valid() {
    let presets = list_presets();
    for preset in &presets {
        let doc = load_preset(&preset.name).unwrap();
        let validation = agent_canvas::graph::validation::ValidationEngine::validate(&doc.to_dag().unwrap());
        assert!(validation.is_valid, "Preset '{}' failed validation: {:?}", preset.name, validation.errors);
    }
}
