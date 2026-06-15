use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum TriggerType {
    Manual,
    OnCommit,
    OnFileChange,
    Scheduled,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TriggerNodeConfig {
    pub trigger_type: TriggerType,
    pub cron_expression: Option<String>,
    pub watch_path: Option<String>,
}

impl TriggerNodeConfig {
    pub fn new(trigger_type: TriggerType, cron_expression: Option<String>, watch_path: Option<String>) -> Self {
        TriggerNodeConfig { trigger_type, cron_expression, watch_path }
    }

    pub fn evaluate(&self) -> bool {
        match self.trigger_type {
            TriggerType::Manual => true,
            TriggerType::OnCommit => true,
            TriggerType::OnFileChange => self.watch_path.is_some(),
            TriggerType::Scheduled => self.cron_expression.is_some(),
        }
    }
}

pub struct TriggerNode;

impl TriggerNode {
    pub fn execute(config: &serde_json::Value, _inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: TriggerNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse TriggerNodeConfig: {}", e),
            })?;

        let triggered = cfg.evaluate();

        if triggered {
            Ok(DataValue::Bool(true))
        } else {
            Ok(DataValue::Bool(false))
        }
    }
}
