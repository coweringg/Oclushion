use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use agent_canvas::graph::dag::Dag;
use agent_canvas::graph::node::{Node, NodeKind};
use agent_canvas::graph::edge::Edge;
use agent_canvas::execution::scheduler::Scheduler;
use agent_canvas::execution::data_flow::{DataFlow, DataValue};
use agent_canvas::execution::error_propagation::{ExecutionError, ErrorStrategy};

fn build_linear_dag() -> Dag {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();
    let n3 = uuid::Uuid::new_v4();

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({"role": "Architect"}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Transform, serde_json::json!({"transform_type": "Map", "params": {"prefix": ">> "}}), (100.0, 0.0), vec![]));
    dag.add_node(Node::new(n3, NodeKind::Agent, serde_json::json!({"role": "Reviewer"}), (200.0, 0.0), vec![]));

    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n1, uuid::Uuid::nil(), n2, uuid::Uuid::nil())).unwrap();
    dag.add_edge(Edge::new(uuid::Uuid::new_v4(), n2, uuid::Uuid::nil(), n3, uuid::Uuid::nil())).unwrap();

    dag
}

#[test]
fn test_scheduler_produces_correct_order() {
    let dag = build_linear_dag();
    let scheduler = Scheduler::new();
    let plan = scheduler.schedule(&dag).unwrap();

    assert!(!plan.steps.is_empty());
    assert!(!plan.node_order.is_empty());

    let all_ids: Vec<_> = dag.nodes.keys().copied().collect();
    for node_id in &plan.node_order {
        assert!(all_ids.contains(node_id));
    }
    assert_eq!(plan.node_order.len(), dag.node_count());
}

#[test]
fn test_scheduler_linear_order() {
    let dag = build_linear_dag();
    let scheduler = Scheduler::new();
    let plan = scheduler.schedule(&dag).unwrap();

    let order: Vec<_> = plan.node_order.iter().copied().collect();
    let edges: Vec<_> = dag.edges.values().collect();
    for edge in &edges {
        let src_pos = order.iter().position(|&x| x == edge.source_node).unwrap();
        let tgt_pos = order.iter().position(|&x| x == edge.target_node).unwrap();
        assert!(src_pos < tgt_pos, "Source must come before target in topological order");
    }
}

#[test]
fn test_execution_with_registered_executors() {
    let dag = build_linear_dag();
    let mut scheduler = Scheduler::new();

    scheduler.register_executor("Agent", |config, _inputs| {
        let role = config.get("role").and_then(|v| v.as_str()).unwrap_or("unknown");
        Ok(DataValue::Text(format!("Agent({}) executed", role)))
    });

    scheduler.register_executor("Transform", |config, inputs| {
        let input = inputs.all_outputs().values().next().map(|v| v.to_string_value()).unwrap_or_default();
        let prefix = config["params"]["prefix"].as_str().unwrap_or("");
        Ok(DataValue::Text(format!("{}{}", prefix, input)))
    });

    let strategies = HashMap::new();
    let cancel_flag = AtomicBool::new(false);
    let (status, _flow) = scheduler.execute(&dag, &strategies, &cancel_flag);

    assert!(matches!(status.state, agent_canvas::execution::scheduler::ExecutionState::Completed));
    assert_eq!(status.results.len(), dag.node_count());
}

#[test]
fn test_empty_dag_execution() {
    let dag = Dag::new();
    let scheduler = Scheduler::new();
    let result = scheduler.schedule(&dag);
    assert!(result.is_ok());
    let plan = result.unwrap();
    assert!(plan.steps.is_empty());
    assert!(plan.node_order.is_empty());
}

#[test]
fn test_data_flow_between_nodes() {
    let mut flow = DataFlow::new();

    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();

    flow.set_output(n1, DataValue::Text("hello".to_string()));

    let output = flow.get_output(&n1);
    assert!(output.is_some());
    assert_eq!(output.unwrap().to_string_value(), "hello");

    let no_output = flow.get_output(&n2);
    assert!(no_output.is_none());
}

#[test]
fn test_error_strategy_skip() {
    let strategy = ErrorStrategy::Skip;
    let result = agent_canvas::execution::error_propagation::ErrorHandler::handle(
        uuid::Uuid::nil(),
        ExecutionError::NodeFailure {
            node_id: uuid::Uuid::nil(),
            message: "test error".into(),
        },
        &strategy,
        0,
    );
    assert!(result.handled);
}

#[test]
fn test_error_strategy_retry_then_fail() {
    let strategy = ErrorStrategy::Retry(2);
    let result = agent_canvas::execution::error_propagation::ErrorHandler::handle(
        uuid::Uuid::nil(),
        ExecutionError::NodeFailure {
            node_id: uuid::Uuid::nil(),
            message: "test error".into(),
        },
        &strategy,
        3,
    );
    assert!(!result.handled);
}

#[test]
fn test_error_strategy_retry_still_recovers() {
    let strategy = ErrorStrategy::Retry(5);
    let result = agent_canvas::execution::error_propagation::ErrorHandler::handle(
        uuid::Uuid::nil(),
        ExecutionError::NodeFailure {
            node_id: uuid::Uuid::nil(),
            message: "test error".into(),
        },
        &strategy,
        1,
    );
    assert!(result.handled);
}

#[test]
fn test_backoff_delay_increases() {
    let d1 = agent_canvas::execution::error_propagation::ErrorHandler::backoff_delay(0);
    let d2 = agent_canvas::execution::error_propagation::ErrorHandler::backoff_delay(1);
    let d3 = agent_canvas::execution::error_propagation::ErrorHandler::backoff_delay(2);
    assert!(d2 > d1);
    assert!(d3 > d2);
}

#[test]
fn test_execution_plan_parallel_flag() {
    let mut dag = Dag::new();
    let n1 = uuid::Uuid::new_v4();
    let n2 = uuid::Uuid::new_v4();

    dag.add_node(Node::new(n1, NodeKind::Agent, serde_json::json!({}), (0.0, 0.0), vec![]));
    dag.add_node(Node::new(n2, NodeKind::Agent, serde_json::json!({}), (100.0, 0.0), vec![]));

    let scheduler = Scheduler::new();
    let plan = scheduler.schedule(&dag).unwrap();

    assert_eq!(plan.steps.len(), 1);
    assert!(plan.steps[0].parallel);
    assert_eq!(plan.steps[0].node_ids.len(), 2);
}
