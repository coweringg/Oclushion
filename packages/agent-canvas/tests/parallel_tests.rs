use agent_canvas::graph::dag::Dag;
use agent_canvas::graph::node::{Node, NodeKind};
use agent_canvas::graph::edge::Edge;
use agent_canvas::execution::parallel::ParallelExecutor;
use agent_canvas::execution::data_flow::{DataFlow, DataValue};

#[test]
fn test_identify_branches_independent_nodes() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Agent, serde_json::json!({}), (100.0, 0.0), vec![]));
    dag.add_node(Node::new(n3, NodeKind::Agent, serde_json::json!({}), (200.0, 0.0), vec![]));

    let branches = ParallelExecutor::identify_branches(&dag);
    assert_eq!(branches.len(), 1);
    assert_eq!(branches[0].len(), 3);
}

#[test]
fn test_identify_branches_parallel_paths() {
    let mut dag = Dag::new();
    let root = uuid::Uuid::new_v4();
    let branch_a = uuid::Uuid::new_v4();
    let branch_b = uuid::Uuid::new_v4();
    let join = uuid::Uuid::new_v4();

    dag.add_node(Node::new(root, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(branch_a, NodeKind::Transform, serde_json::json!({}), (100.0, -50.0), vec![]));
    dag.add_node(Node::new(branch_b, NodeKind::Transform, serde_json::json!({}), (100.0, 50.0), vec![]));
    dag.add_node(Node::new(join, NodeKind::Agent, serde_json::json!({}), (200.0, 0.0), vec![]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), root, uuid::Uuid::nil(), branch_a, uuid::Uuid::nil())).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), root, uuid::Uuid::nil(), branch_b, uuid::Uuid::nil())).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), branch_a, uuid::Uuid::nil(), join, uuid::Uuid::nil())).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), branch_b, uuid::Uuid::nil(), join, uuid::Uuid::nil())).unwrap();

    let branches = ParallelExecutor::identify_branches(&dag);
    assert!(branches.len() >= 2);
}

#[test]
fn test_identify_branches_linear_chain() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Transform, serde_json::json!({}), (100.0, 0.0), vec![]));
    dag.add_node(Node::new(n3, NodeKind::Agent, serde_json::json!({}), (200.0, 0.0), vec![]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, uuid::Uuid::nil(), n2, uuid::Uuid::nil())).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n2, uuid::Uuid::nil(), n3, uuid::Uuid::nil())).unwrap();

    let branches = ParallelExecutor::identify_branches(&dag);
    assert_eq!(branches.len(), 3);
}

#[test]
fn test_execute_branches() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Agent, serde_json::json!({}), (100.0, 0.0), vec![]));

    let branches = ParallelExecutor::identify_branches(&dag);
    let mut flow = DataFlow::new();

    let results = ParallelExecutor::execute_branches(
        &branches,
        &mut flow,
        &|node_id, f| {
            f.set_output(node_id, DataValue::Text(format!("node {} executed", node_id)));
            Ok(DataValue::Text("ok".into()))
        },
    );

    assert_eq!(results.len(), 2);
    for result in results.values() {
        assert!(result.is_ok());
    }
}

#[test]
fn test_empty_dag_no_branches() {
    let dag = Dag::new();
    let branches = ParallelExecutor::identify_branches(&dag);
    assert!(branches.is_empty());
}
