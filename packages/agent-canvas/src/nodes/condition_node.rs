use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ConditionOperator {
    Contains,
    Equals,
    GreaterThan,
    LessThan,
    RegexMatch,
    Custom,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConditionNodeConfig {
    pub expression: String,
    pub operator: ConditionOperator,
}

impl ConditionNodeConfig {
    pub fn new(expression: String, operator: ConditionOperator) -> Self {
        ConditionNodeConfig { expression, operator }
    }
}

pub struct ConditionNode;

impl ConditionNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: ConditionNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse ConditionNodeConfig: {}", e),
            })?;

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        let result = match cfg.operator {
            ConditionOperator::Contains => input_text.contains(&cfg.expression),
            ConditionOperator::Equals => input_text == cfg.expression,
            ConditionOperator::GreaterThan => {
                let a: f64 = input_text.parse().unwrap_or(0.0);
                let b: f64 = cfg.expression.parse().unwrap_or(0.0);
                a > b
            }
            ConditionOperator::LessThan => {
                let a: f64 = input_text.parse().unwrap_or(0.0);
                let b: f64 = cfg.expression.parse().unwrap_or(0.0);
                a < b
            }
            ConditionOperator::RegexMatch => {
                simple_glob_match(&cfg.expression, &input_text)
            }
            ConditionOperator::Custom => false,
        };

        Ok(DataValue::Bool(result))
    }
}

fn simple_glob_match(pattern: &str, text: &str) -> bool {
    if pattern == "*" {
        return !text.is_empty();
    }
    if pattern.starts_with('*') && pattern.ends_with('*') {
        let inner = &pattern[1..pattern.len()-1];
        return text.contains(inner);
    }
    if pattern.starts_with('*') {
        let suffix = &pattern[1..];
        return text.ends_with(suffix);
    }
    if pattern.ends_with('*') {
        let prefix = &pattern[..pattern.len()-1];
        return text.starts_with(prefix);
    }
    text.contains(pattern)
}
