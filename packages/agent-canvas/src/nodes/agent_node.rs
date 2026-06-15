use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum AgentRole {
    Architect,
    Builder,
    Reviewer,
    Qa,
    Docs,
    Security,
    FinOps,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Model {
    Claude,
    Gpt,
    Gemini,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AgentNodeConfig {
    pub role: AgentRole,
    pub model: Model,
    pub system_prompt: Option<String>,
}

impl AgentNodeConfig {
    pub fn new(role: AgentRole, model: Model, system_prompt: Option<String>) -> Self {
        AgentNodeConfig { role, model, system_prompt }
    }
}

pub struct AgentNode;

impl AgentNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: AgentNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse AgentNodeConfig: {}", e),
            })?;

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        let role_str = format!("{:?}", cfg.role);
        let model_str = format!("{:?}", cfg.model);

        let output = format!(
            "[{}] Agent executed: input='{}', role={}, model={}, system_prompt={}",
            model_str,
            input_text,
            role_str,
            model_str,
            cfg.system_prompt.as_deref().unwrap_or("none"),
        );

        Ok(DataValue::Text(output))
    }
}
