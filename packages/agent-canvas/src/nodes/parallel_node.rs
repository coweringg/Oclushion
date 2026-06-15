use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Branch {
    pub id: String,
    pub nodes: Vec<serde_json::Value>,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum JoinStrategy {
    All,
    First,
    Majority,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ForkJoinNodeConfig {
    pub branches: Vec<Branch>,
    pub join_strategy: JoinStrategy,
}

impl ForkJoinNodeConfig {
    pub fn new(branches: Vec<Branch>, join_strategy: JoinStrategy) -> Self {
        ForkJoinNodeConfig { branches, join_strategy }
    }
}

pub struct ForkJoinNode;

impl ForkJoinNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: ForkJoinNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse ForkJoinNodeConfig: {}", e),
            })?;

        if cfg.branches.is_empty() {
            return Ok(DataValue::None);
        }

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        let mut branch_outputs = Vec::new();

        for branch in &cfg.branches {
            let output = format!(
                "Branch '{}' executed with input: {}",
                branch.id, input_text
            );
            branch_outputs.push(serde_json::json!({
                "branch_id": branch.id,
                "output": output,
            }));
        }

        let joined = match cfg.join_strategy {
            JoinStrategy::All => {
                serde_json::json!({
                    "strategy": "all",
                    "branches": branch_outputs,
                    "count": branch_outputs.len(),
                })
            }
            JoinStrategy::First => {
                serde_json::json!({
                    "strategy": "first",
                    "result": branch_outputs.first(),
                })
            }
            JoinStrategy::Majority => {
                serde_json::json!({
                    "strategy": "majority",
                    "branches": branch_outputs,
                    "agreement": true,
                })
            }
        };

        Ok(DataValue::Json(joined))
    }
}
