use std::collections::HashMap;
use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum WebhookMethod {
    POST,
    PUT,
    PATCH,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookNodeConfig {
    pub url: String,
    pub method: WebhookMethod,
    pub headers: HashMap<String, String>,
    pub body_template: Option<String>,
}

impl WebhookNodeConfig {
    pub fn new(url: String, method: WebhookMethod, headers: HashMap<String, String>, body_template: Option<String>) -> Self {
        WebhookNodeConfig { url, method, headers, body_template }
    }

    pub fn is_url_allowed(&self, allowlist: &[&str]) -> bool {
        if allowlist.is_empty() {
            return false;
        }
        allowlist.iter().any(|&allowed| {
            self.url.starts_with(allowed)
                || self.url.contains(allowed)
        })
    }
}

const DEFAULT_ALLOWLIST: &[&str] = &[
    "https://api.github.com",
    "https://hooks.slack.com",
    "https://webhook.example.com",
    "http://localhost",
    "https://localhost",
];

pub struct WebhookNode;

impl WebhookNode {
    pub fn execute(config: &serde_json::Value, inputs: &DataFlow) -> Result<DataValue, ExecutionError> {
        let cfg: WebhookNodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("Failed to parse WebhookNodeConfig: {}", e),
            })?;

        if !cfg.is_url_allowed(DEFAULT_ALLOWLIST) {
            return Err(ExecutionError::NodeFailure {
                node_id: uuid::Uuid::nil(),
                message: format!("URL '{}' is not in the allowed list", cfg.url),
            });
        }

        let method_str = match cfg.method {
            WebhookMethod::POST => "POST",
            WebhookMethod::PUT => "PUT",
            WebhookMethod::PATCH => "PATCH",
        };

        let input_text = inputs.all_outputs().values()
            .next()
            .map(|v| v.to_string_value())
            .unwrap_or_default();

        let body = cfg.body_template.as_ref()
            .map(|template| template.replace("{{input}}", &input_text))
            .unwrap_or_else(|| input_text.clone());

        let response = serde_json::json!({
            "status": "simulated",
            "url": cfg.url,
            "method": method_str,
            "headers": cfg.headers,
            "body": body,
            "response_code": 200,
            "response_body": format!("Webhook sent to {} successfully", cfg.url),
        });

        Ok(DataValue::Json(response))
    }
}
