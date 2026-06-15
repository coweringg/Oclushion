use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;
use crate::NodeId;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApprovalNodeConfig {
    pub message: String,
    pub timeout_minutes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<ApprovalState>,
}

impl ApprovalNodeConfig {
    pub fn new(message: String, timeout_minutes: Option<u32>) -> Self {
        ApprovalNodeConfig { message, timeout_minutes, state: Some(ApprovalState::Pending) }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ApprovalState {
    Pending,
    Approved(String),
    Rejected(String, String),
}

impl ApprovalState {
    pub fn is_pending(&self) -> bool {
        matches!(self, ApprovalState::Pending)
    }

    pub fn is_approved(&self) -> bool {
        matches!(self, ApprovalState::Approved(_))
    }

    pub fn approved_by(&self) -> Option<&str> {
        match self {
            ApprovalState::Approved(user) => Some(user.as_str()),
            _ => None,
        }
    }

    pub fn rejected_info(&self) -> Option<(&str, &str)> {
        match self {
            ApprovalState::Rejected(user, reason) => Some((user.as_str(), reason.as_str())),
            _ => None,
        }
    }
}

pub struct ApprovalNode;

impl ApprovalNode {
    pub fn set_approval_state(
        dag: &mut crate::graph::dag::Dag,
        node_id: &NodeId,
        state: ApprovalState,
    ) -> Result<(), ExecutionError> {
        let node = dag.get_node_mut(node_id).ok_or_else(|| ExecutionError::NodeFailure {
            node_id: *node_id,
            message: "Node not found".into(),
        })?;

        let mut cfg: ApprovalNodeConfig = serde_json::from_value(node.config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: *node_id,
                message: format!("Failed to parse config: {}", e),
            })?;

        cfg.state = Some(state);
        node.config = serde_json::to_value(cfg).unwrap_or_default();
        Ok(())
    }

    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: ApprovalNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse ApprovalNodeConfig: {}", e),
            })?;

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        match cfg.state {
            Some(ApprovalState::Pending) => {
                Ok(DataValue::Json(serde_json::json!({
                    "status": "pending",
                    "message": cfg.message,
                    "input": input_text,
                    "requires_approval": true,
                })))
            }
            Some(ApprovalState::Approved(user)) => {
                Ok(DataValue::Json(serde_json::json!({
                    "status": "approved",
                    "approved_by": user,
                    "input": input_text,
                })))
            }
            Some(ApprovalState::Rejected(user, reason)) => {
                Ok(DataValue::Json(serde_json::json!({
                    "status": "rejected",
                    "rejected_by": user,
                    "reason": reason,
                    "input": input_text,
                })))
            }
            None => {
                Ok(DataValue::Json(serde_json::json!({
                    "status": "pending",
                    "message": cfg.message,
                    "input": input_text,
                    "requires_approval": true,
                })))
            }
        }
    }
}
