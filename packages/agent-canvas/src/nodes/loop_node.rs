use std::collections::HashMap;
use crate::NodeId;
use crate::graph::node::Node;
use crate::graph::edge::Edge;
use crate::graph::dag::Dag;
use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoopNodeConfig {
    pub subgraph_nodes: Vec<Node>,
    pub subgraph_edges: Vec<Edge>,
    pub max_iterations: u32,
    pub condition: Option<String>,
    pub count: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoopResult {
    pub iterations: u32,
    pub outputs: Vec<HashMap<NodeId, DataValue>>,
    pub terminated_by: String,
}

pub struct LoopNode;

impl LoopNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: LoopNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse LoopNodeConfig: {}", e),
            })?;

        let max_iterations = cfg.max_iterations.min(10);
        let count = cfg.count.unwrap_or(max_iterations);
        let effective_max = count.min(max_iterations);

        let mut sub_dag = Dag::new();
        for node in &cfg.subgraph_nodes {
            sub_dag.add_node(node.clone());
        }
        for edge in &cfg.subgraph_edges {
            let _ = sub_dag.add_edge(edge.clone());
        }

        let mut iteration_outputs = Vec::new();
        let mut iteration_flow = DataFlow::new();

        for (_, output) in inputs.all_outputs() {
            iteration_flow.set_output(uuid::Uuid::nil(), output.clone());
        }

        let mut terminated_by = "completed".to_string();

        for i in 0..effective_max {
            let mut iter_outputs = HashMap::new();

            let topo = match sub_dag.topological_sort() {
                Ok(order) => order,
                Err(_) => {
                    terminated_by = "cycle_detected".to_string();
                    break;
                }
            };

            for node_id in &topo {
                let node = match sub_dag.get_node(node_id) {
                    Some(n) => n,
                    None => continue,
                };

                iteration_flow.get_input(node_id, &sub_dag)
                    .unwrap_or(DataValue::None);

                let output = match node.node_type {
                    crate::graph::node::NodeKind::Transform => {
                        crate::nodes::transform_node::TransformNode::execute(&node.config, &iteration_flow)
                    }
                    _ => Ok(DataValue::Text(format!("Loop iteration {} output for {}", i, node_id))),
                };

                match output {
                    Ok(val) => {
                        iteration_flow.set_output(*node_id, val.clone());
                        iter_outputs.insert(*node_id, val);
                    }
                    Err(e) => {
                        if i < effective_max - 1 {
                            terminated_by = format!("error: {}", e);
                            break;
                        }
                    }
                }
            }

            if !iter_outputs.is_empty() {
                iteration_outputs.push(iter_outputs);
            }

            if let Some(ref condition) = cfg.condition {
                if iteration_flow.all_outputs().values().any(|v| v.to_string_value().contains(condition)) {
                    terminated_by = "condition_met".to_string();
                    break;
                }
            }
        }

        let result = LoopResult {
            iterations: iteration_outputs.len() as u32,
            outputs: iteration_outputs,
            terminated_by,
        };

        Ok(DataValue::Json(serde_json::to_value(result).unwrap_or_default()))
    }
}
