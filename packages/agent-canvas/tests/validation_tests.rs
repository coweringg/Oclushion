use agent_canvas::graph::dag::Dag;
use agent_canvas::graph::node::{Node, NodeKind};
use agent_canvas::graph::edge::Edge;
use agent_canvas::graph::port::{Port, PortDirection, DataType};
use agent_canvas::graph::validation::{ValidationEngine, ErrorCode};

fn make_dag() -> Dag {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();

    let p1_out = uuid::Uuid::new_v4();
    let p2_in = uuid::Uuid::new_v4();
    let p2_out = uuid::Uuid::new_v4();
    let p3_in = uuid::Uuid::new_v4();

    dag.add_port(Port::new(p1_out, PortDirection::Output, DataType::Text, "output".into()));
    dag.add_port(Port::new(p2_in, PortDirection::Input, DataType::Text, "input".into()));
    dag.add_port(Port::new(p2_out, PortDirection::Output, DataType::Text, "output".into()));
    dag.add_port(Port::new(p3_in, PortDirection::Input, DataType::Text, "input".into()));

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![p1_out]));
    dag.add_node(Node::new(n2, NodeKind::Transform, serde_json::json!({}), (100.0, 0.0), vec![p2_in, p2_out]));
    dag.add_node(Node::new(n3, NodeKind::Agent, serde_json::json!({}), (200.0, 0.0), vec![p3_in]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, p1_out, n2, p2_in)).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n2, p2_out, n3, p3_in)).unwrap();

    dag
}

#[test]
fn test_valid_dag_passes_validation() {
    let dag = make_dag();
    let result = ValidationEngine::validate(&dag);
    assert!(result.is_valid);
    assert!(result.errors.is_empty());
}

#[test]
fn test_cycle_detected() {
    let mut dag = make_dag();
    let n1 = dag.nodes.keys().next().unwrap().clone();
    let n3 = dag.nodes.keys().last().unwrap().clone();

    let p1_in = uuid::Uuid::new_v4();
    dag.add_port(Port::new(p1_in, PortDirection::Input, DataType::Text, "input".into()));
    if let Some(node) = dag.get_node_mut(&n1) {
        node.ports.push(p1_in);
    }

    let p3_out = uuid::Uuid::new_v4();
    dag.add_port(Port::new(p3_out, PortDirection::Output, DataType::Text, "output".into()));
    if let Some(node) = dag.get_node_mut(&n3) {
        node.ports.push(p3_out);
    }
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n3, p3_out, n1, p1_in)).ok();

    let result = ValidationEngine::validate(&dag);
    let has_cycle_error = result.errors.iter().any(|e| matches!(e.code, ErrorCode::CycleDetected));
    assert!(has_cycle_error);
    assert!(!result.is_valid);
}

#[test]
fn test_port_type_mismatch() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();

    let p1_out = uuid::Uuid::new_v4();
    let p2_in = uuid::Uuid::new_v4();

    dag.add_port(Port::new(p1_out, PortDirection::Output, DataType::Text, "output".into()));
    dag.add_port(Port::new(p2_in, PortDirection::Input, DataType::Bool, "input".into()));

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![p1_out]));
    dag.add_node(Node::new(n2, NodeKind::Condition, serde_json::json!({}), (100.0, 0.0), vec![p2_in]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, p1_out, n2, p2_in)).unwrap();

    let result = ValidationEngine::validate(&dag);
    let has_type_error = result.errors.iter().any(|e| matches!(e.code, ErrorCode::PortTypeMismatch));
    assert!(has_type_error);
}

#[test]
fn test_any_type_matches_anything() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();

    let p1_out = uuid::Uuid::new_v4();
    let p2_in = uuid::Uuid::new_v4();

    dag.add_port(Port::new(p1_out, PortDirection::Output, DataType::Any, "output".into()));
    dag.add_port(Port::new(p2_in, PortDirection::Input, DataType::Text, "input".into()));

    dag.add_node(Node::new(n1, NodeKind::Transform, serde_json::json!({}), (0.0, 0.0), vec![p1_out]));
    dag.add_node(Node::new(n2, NodeKind::Agent, serde_json::json!({}), (100.0, 0.0), vec![p2_in]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, p1_out, n2, p2_in)).unwrap();

    let result = ValidationEngine::validate(&dag);
    assert!(result.is_valid);
}

#[test]
fn test_warns_disconnected_node() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();

    dag.add_port(Port::new(uuid::Uuid::new_v4(), PortDirection::Output, DataType::Text, "output".into()));
    dag.add_port(Port::new(uuid::Uuid::new_v4(), PortDirection::Input, DataType::Text, "input".into()));

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Transform, serde_json::json!({}), (100.0, 0.0), vec![]));
    dag.add_node(Node::new(n3, NodeKind::Agent, serde_json::json!({}), (200.0, 0.0), vec![]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, uuid::Uuid::nil(), n2, uuid::Uuid::nil())).unwrap();

    let result = ValidationEngine::validate(&dag);
    let has_warning = result.warnings.iter().any(|w| w.contains("disconnected"));
    assert!(has_warning);
}
