use agent_canvas::graph::dag::Dag;
use agent_canvas::graph::node::{Node, NodeKind};
use agent_canvas::graph::edge::Edge;
use agent_canvas::{NodeId, EdgeId};

fn create_test_node(id: NodeId) -> Node {
    Node::new(id, NodeKind::Agent, serde_json::json!({"role": "Builder"}), (0.0, 0.0), vec![])
}

fn create_test_edge(id: EdgeId, src: NodeId, tgt: NodeId) -> Edge {
    let port = uuid::Uuid::nil();
    Edge::new(id, src, port, tgt, port)
}

#[test]
fn test_new_dag_is_empty() {
    let dag = Dag::new();
    assert!(dag.is_empty());
    assert_eq!(dag.node_count(), 0);
    assert_eq!(dag.edge_count(), 0);
}

#[test]
fn test_add_node() {
    let mut dag = Dag::new();
    let id = uuid::Uuid::new_v4();
    let node = create_test_node(id);
    dag.add_node(node);
    assert_eq!(dag.node_count(), 1);
    assert!(!dag.is_empty());
    assert!(dag.get_node(&id).is_some());
}

#[test]
fn test_remove_node() {
    let mut dag = Dag::new();
    let id = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(id));
    dag.remove_node(id).unwrap();
    assert!(dag.is_empty());
}

#[test]
fn test_remove_nonexistent_node() {
    let mut dag = Dag::new();
    let id = uuid::Uuid::new_v4();
    let result = dag.remove_node(id);
    assert!(result.is_err());
}

#[test]
fn test_add_edge() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    let eid = uuid::Uuid::new_v4();
    dag.add_edge(create_test_edge(eid, n1, n2)).unwrap();
    assert_eq!(dag.edge_count(), 1);
}

#[test]
fn test_add_edge_to_nonexistent_node() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    let eid = uuid::Uuid::new_v4();
    let result = dag.add_edge(create_test_edge(eid, n1, n2));
    assert!(result.is_err());
}

#[test]
fn test_remove_edge() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    let eid = uuid::Uuid::new_v4();
    dag.add_edge(create_test_edge(eid, n1, n2)).unwrap();
    dag.remove_edge(eid).unwrap();
    assert_eq!(dag.edge_count(), 0);
}

#[test]
fn test_topological_sort_linear() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_node(create_test_node(n3));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n2, n3)).unwrap();
    let order = dag.topological_sort().unwrap();
    assert_eq!(order.len(), 3);
    let pos_n1 = order.iter().position(|&x| x == n1).unwrap();
    let pos_n2 = order.iter().position(|&x| x == n2).unwrap();
    let pos_n3 = order.iter().position(|&x| x == n3).unwrap();
    assert!(pos_n1 < pos_n2);
    assert!(pos_n2 < pos_n3);
}

#[test]
fn test_topological_sort_parallel() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();
    let n4 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_node(create_test_node(n3));
    dag.add_node(create_test_node(n4));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n3)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n2, n4)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n3, n4)).unwrap();
    let order = dag.topological_sort().unwrap();
    assert_eq!(order.len(), 4);
}

#[test]
fn test_cycle_detection() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_node(create_test_node(n3));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n2, n3)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n3, n1)).unwrap();
    assert!(dag.has_cycle());
    assert!(dag.topological_sort().is_err());
}

#[test]
fn test_no_cycle() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_node(create_test_node(n3));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n2, n3)).unwrap();
    assert!(!dag.has_cycle());
}

#[test]
fn test_get_children() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    let children = dag.get_children(&n1);
    assert_eq!(children.len(), 1);
    assert_eq!(*children[0], n2);
}

#[test]
fn test_get_parents() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    let parents = dag.get_parents(&n2);
    assert_eq!(parents.len(), 1);
    assert_eq!(parents[0], n1);
}

#[test]
fn test_remove_node_removes_edges() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();
    dag.add_node(create_test_node(n1));
    dag.add_node(create_test_node(n2));
    dag.add_node(create_test_node(n3));
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n1, n2)).unwrap();
    dag.add_edge(create_test_edge(uuid::Uuid::new_v4(), n2, n3)).unwrap();
    dag.remove_node(n2).unwrap();
    assert_eq!(dag.node_count(), 2);
    assert_eq!(dag.edge_count(), 0);
}
