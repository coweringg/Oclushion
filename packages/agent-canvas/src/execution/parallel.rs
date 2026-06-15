use std::collections::{HashMap, HashSet};
use crate::NodeId;
use crate::graph::dag::Dag;
use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

pub struct ParallelExecutor;

impl ParallelExecutor {
    pub fn identify_branches(dag: &Dag) -> Vec<Vec<NodeId>> {
        let topo = match dag.topological_sort() {
            Ok(order) => order,
            Err(_) => return Vec::new(),
        };

        let mut groups: Vec<Vec<NodeId>> = Vec::new();
        let mut processed = HashSet::new();
        let mut current_group = Vec::new();

        for &node_id in &topo {
            if processed.contains(&node_id) {
                continue;
            }

            let parents: HashSet<NodeId> = dag.get_parents(&node_id).into_iter().collect();
            let all_parents_processed = parents.is_empty() || parents.iter().all(|p| processed.contains(p));

            if all_parents_processed {
                let has_dep_with_group = current_group.iter().any(|g| {
                    dag.edges.values().any(|e| {
                        (e.source_node == *g && e.target_node == node_id)
                            || (e.source_node == node_id && e.target_node == *g)
                    })
                });

                if !has_dep_with_group {
                    current_group.push(node_id);
                    processed.insert(node_id);
                } else {
                    if !current_group.is_empty() {
                        groups.push(current_group.clone());
                    }
                    current_group = vec![node_id];
                    processed.insert(node_id);
                }
            }
        }

        if !current_group.is_empty() {
            groups.push(current_group);
        }

        groups
    }

    pub fn execute_branches(
        branches: &[Vec<NodeId>],
        flow: &mut DataFlow,
        execute_node: &dyn Fn(NodeId, &mut DataFlow) -> Result<DataValue, ExecutionError>,
    ) -> HashMap<NodeId, Result<DataValue, ExecutionError>> {
        let mut results = HashMap::new();

        for branch in branches {
            for &node_id in branch {
                let result = execute_node(node_id, flow);
                if let Ok(ref value) = result {
                    flow.set_output(node_id, value.clone());
                }
                results.insert(node_id, result);
            }
        }

        results
    }
}
