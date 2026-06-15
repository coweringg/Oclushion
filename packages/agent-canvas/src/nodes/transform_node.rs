use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum TransformType {
    Filter,
    Map,
    Combine,
    Split,
    Extract,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TransformNodeConfig {
    pub transform_type: TransformType,
    pub params: serde_json::Value,
}

impl TransformNodeConfig {
    pub fn new(transform_type: TransformType, params: serde_json::Value) -> Self {
        TransformNodeConfig { transform_type, params }
    }
}

pub struct TransformNode;

impl TransformNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: TransformNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse TransformNodeConfig: {}", e),
            })?;

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        let input_json = inputs.all_outputs().values()
            .find_map(|v| v.as_json().cloned());

        let result = match cfg.transform_type {
            TransformType::Filter => {
                let filter_key = cfg.params.get("key").and_then(|v| v.as_str()).unwrap_or("");
                let filter_value = cfg.params.get("value").and_then(|v| v.as_str()).unwrap_or("");
                let lines: Vec<&str> = input_text.lines()
                    .filter(|line| line.contains(filter_key) || line.contains(filter_value))
                    .collect();
                DataValue::Text(lines.join("\n"))
            }
            TransformType::Map => {
                let prefix = cfg.params.get("prefix").and_then(|v| v.as_str()).unwrap_or("");
                let suffix = cfg.params.get("suffix").and_then(|v| v.as_str()).unwrap_or("");
                let mapped: String = input_text.lines()
                    .map(|line| format!("{}{}{}", prefix, line, suffix))
                    .collect::<Vec<_>>()
                    .join("\n");
                DataValue::Text(mapped)
            }
            TransformType::Combine => {
                let separator = cfg.params.get("separator").and_then(|v| v.as_str()).unwrap_or("\n");
                let combined: Vec<String> = inputs.all_outputs().values()
                    .map(|v| v.to_string_value())
                    .collect();
                DataValue::Text(combined.join(separator))
            }
            TransformType::Split => {
                let delimiter = cfg.params.get("delimiter").and_then(|v| v.as_str()).unwrap_or(",");
                let parts: Vec<DataValue> = input_text.split(delimiter)
                    .map(|s| DataValue::Text(s.trim().to_string()))
                    .collect();
                if parts.len() == 1 {
                    DataValue::Text(parts[0].to_string_value())
                } else {
                    DataValue::Multiple(parts.into_iter().map(Box::new).collect())
                }
            }
            TransformType::Extract => {
                let path = cfg.params.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if let Some(json) = input_json {
                    let extracted = json.pointer(path)
                        .map(|v| v.to_string())
                        .unwrap_or_default();
                    DataValue::Text(extracted)
                } else {
                    DataValue::Text(input_text)
                }
            }
        };

        Ok(result)
    }
}
