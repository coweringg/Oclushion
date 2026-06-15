use std::collections::{HashMap, HashSet};
use crate::NodeId;
use crate::graph::dag::Dag;
use crate::graph::dag::GraphError;
use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::{ExecutionError, ErrorStrategy, ErrorHandler};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExecutionStep {
    pub step_number: u32,
    pub node_ids: Vec<NodeId>,
    pub parallel: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExecutionPlan {
    pub steps: Vec<ExecutionStep>,
    pub node_order: Vec<NodeId>,
    pub parallel_groups: Vec<Vec<NodeId>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ExecutionState {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExecutionStatus {
    pub workflow_id: NodeId,
    pub state: ExecutionState,
    pub current_step: u32,
    pub results: HashMap<NodeId, DataValue>,
    pub progress: f64,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub type NodeExecutor = fn(&serde_json::Value, &DataFlow) -> Result<DataValue, ExecutionError>;

pub struct Scheduler {
    executors: HashMap<String, NodeExecutor>,
}

impl Scheduler {
    pub fn new() -> Self {
        Scheduler {
            executors: HashMap::new(),
        }
    }

    pub fn register_executor(&mut self, node_type: &str, executor: NodeExecutor) {
        self.executors.insert(node_type.to_string(), executor);
    }

    pub fn schedule(&self, dag: &Dag) -> Result<ExecutionPlan, GraphError> {
        let topo_order = dag.topological_sort()?;
        let steps = self.build_steps(dag, &topo_order);
        let parallel_groups = self.identify_parallel_groups(dag, &topo_order);

        Ok(ExecutionPlan {
            steps,
            node_order: topo_order,
            parallel_groups,
        })
    }

    fn build_steps(&self, dag: &Dag, topo_order: &[NodeId]) -> Vec<ExecutionStep> {
        let mut visited = HashSet::new();
        let mut steps = Vec::new();
        let mut step_number = 0u32;

        while visited.len() < topo_order.len() {
            let mut current_group = Vec::new();
            for node_id in topo_order {
                if visited.contains(node_id) {
                    continue;
                }
                let parents: HashSet<NodeId> = dag.get_parents(node_id).into_iter().collect();
                if parents.is_empty() || parents.iter().all(|p| visited.contains(p)) {
                    current_group.push(*node_id);
                }
            }
            if current_group.is_empty() {
                break;
            }
            for node_id in &current_group {
                visited.insert(*node_id);
            }
            let parallel = current_group.len() > 1;
            steps.push(ExecutionStep {
                step_number,
                node_ids: current_group,
                parallel,
            });
            step_number += 1;
        }
        steps
    }

    fn identify_parallel_groups(&self, dag: &Dag, topo_order: &[NodeId]) -> Vec<Vec<NodeId>> {
        let mut groups = Vec::new();
        let mut visited = HashSet::new();
        for node_id in topo_order {
            if visited.contains(node_id) {
                continue;
            }
            let parents: HashSet<NodeId> = dag.get_parents(node_id).into_iter().collect();
            if parents.is_empty() || parents.iter().all(|p| visited.contains(p)) {
                let mut group = vec![*node_id];
                visited.insert(*node_id);
                for other in topo_order {
                    if visited.contains(other) || other == node_id {
                        continue;
                    }
                    let other_parents: HashSet<NodeId> = dag.get_parents(other).into_iter().collect();
                    if other_parents.is_empty() || other_parents.iter().all(|p| visited.contains(p)) {
                        let has_dep = group.iter().any(|g| {
                            dag.edges.values().any(|e| e.source_node == *g && e.target_node == *other)
                                || dag.edges.values().any(|e| e.source_node == *other && e.target_node == *g)
                        });
                        if !has_dep {
                            group.push(*other);
                            visited.insert(*other);
                        }
                    }
                }
                groups.push(group);
            }
        }
        groups
    }

    pub fn execute(
        &self,
        dag: &Dag,
        strategies: &HashMap<NodeId, ErrorStrategy>,
        cancel_flag: &std::sync::atomic::AtomicBool,
    ) -> (ExecutionStatus, DataFlow) {
        let plan = self.schedule(dag);
        let plan = match plan {
            Ok(p) => p,
            Err(_) => {
                let status = ExecutionStatus {
                    workflow_id: NodeId::default(),
                    state: ExecutionState::Failed,
                    current_step: 0,
                    results: HashMap::new(),
                    progress: 0.0,
                    started_at: Some(chrono::Utc::now()),
                    completed_at: Some(chrono::Utc::now()),
                };
                return (status, DataFlow::new());
            }
        };

        let mut flow = DataFlow::new();
        let started_at = chrono::Utc::now();
        let mut all_results = HashMap::new();
        let mut final_state = ExecutionState::Running;

        for step in plan.steps.iter() {
            if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                final_state = ExecutionState::Cancelled;
                break;
            }

            for &node_id in &step.node_ids {
                let node = match dag.get_node(&node_id) {
                    Some(n) => n,
                    None => {
                        all_results.insert(node_id, DataValue::None);
                        continue;
                    }
                };

                let node_type_str = format!("{:?}", node.node_type);
                let executor = self.executors.get(&node_type_str);

                let mut attempt = 0u32;
                let result = loop {
                    let exec_result = if let Some(exec) = executor {
                        exec(&node.config, &flow)
                    } else {
                        Err(ExecutionError::NodeFailure {
                            node_id,
                            message: format!("No executor registered for {:?}", node.node_type),
                        })
                    };

                    match exec_result {
                        Ok(value) => {
                            flow.set_output(node_id, value.clone());
                            all_results.insert(node_id, value);
                            break Ok(());
                        }
                        Err(e) => {
                            let strategy = strategies.get(&node_id).cloned().unwrap_or(ErrorStrategy::Abort);
                            let result = ErrorHandler::handle(node_id, e, &strategy, attempt);
                            if result.handled {
                                match &result.strategy_used {
                                    ErrorStrategy::Retry(_) => {
                                        attempt += 1;
                                        continue;
                                    }
                                    ErrorStrategy::Skip => {
                                        all_results.insert(node_id, DataValue::None);
                                        break Ok(());
                                    }
                                    ErrorStrategy::Fallback(fallback) => {
                                        if let Some(fb_val) = flow.get_output(fallback) {
                                            all_results.insert(node_id, fb_val.clone());
                                        } else {
                                            all_results.insert(node_id, DataValue::None);
                                        }
                                        break Ok(());
                                    }
                                    ErrorStrategy::Abort => {
                                        break Err(result.error);
                                    }
                                }
                            } else {
                                break Err(result.error);
                            }
                        }
                    }
                };

                if let Err(_e) = result {
                    final_state = ExecutionState::Failed;
                    all_results.insert(node_id, DataValue::None);
                }
            }

            if matches!(final_state, ExecutionState::Failed | ExecutionState::Cancelled) {
                break;
            }
        }

        if matches!(final_state, ExecutionState::Running) {
            final_state = ExecutionState::Completed;
        }

        let completed_at = chrono::Utc::now();
        let progress = if matches!(final_state, ExecutionState::Running) {
            0.0
        } else {
            1.0
        };

        let status = ExecutionStatus {
            workflow_id: NodeId::default(),
            state: final_state,
            current_step: 0,
            results: all_results,
            progress,
            started_at: Some(started_at),
            completed_at: Some(completed_at),
        };

        (status, flow)
    }
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}
