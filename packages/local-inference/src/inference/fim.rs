use crate::sidecar::ipc::IpcClient;
use crate::{CompletionRequest, InferenceError};
use std::time::Duration;

pub struct FimEngine;

impl FimEngine {
    pub fn build_fim_prompt(prefix: &str, suffix: &str) -> String {
        format!(
            "<|fim_prefix|>{}<|fim_suffix|>{}<|fim_middle|>",
            prefix, suffix
        )
    }

    pub async fn generate_completion(
        &self,
        client: &IpcClient,
        prompt: &str,
        timeout_ms: u64,
    ) -> Result<Option<String>, InferenceError> {
        let req = CompletionRequest {
            prompt: prompt.to_string(),
            max_tokens: Some(128),
            temperature: Some(0.2),
            top_p: Some(0.9),
            stream: Some(false),
            ..Default::default()
        };

        let result = tokio::time::timeout(
            Duration::from_millis(timeout_ms),
            client.send_request(req),
        )
        .await
        .map_err(|_| InferenceError::Timeout("FIM generation timed out".into()))??;

        Ok(result.choices.into_iter().next().map(|c| c.text))
    }
}
