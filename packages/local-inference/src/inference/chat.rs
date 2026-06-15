use serde::{Deserialize, Serialize};
use crate::sidecar::ipc::IpcClient;
use crate::CompletionRequest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub struct ChatEngine;

impl ChatEngine {
    pub fn build_chat_messages(system: &str, history: &[ChatMessage]) -> Vec<ChatMessage> {
        let mut messages = Vec::new();
        messages.push(ChatMessage {
            role: "system".into(),
            content: system.to_string(),
        });
        messages.extend_from_slice(history);
        messages
    }

    pub fn format_chat_prompt(messages: &[ChatMessage]) -> String {
        let mut prompt = String::new();
        for msg in messages {
            match msg.role.as_str() {
                "system" => prompt.push_str(&format!("<|system|>\n{}\n", msg.content)),
                "user" => prompt.push_str(&format!("<|user|>\n{}\n", msg.content)),
                "assistant" => prompt.push_str(&format!("<|assistant|>\n{}\n", msg.content)),
                _ => prompt.push_str(&format!("<|{}|>\n{}\n", msg.role, msg.content)),
            }
        }
        prompt.push_str("<|assistant|>\n");
        prompt
    }

    pub async fn generate(
        &self,
        client: &IpcClient,
        messages: &[ChatMessage],
    ) -> Result<String, crate::InferenceError> {
        let prompt = Self::format_chat_prompt(messages);
        let req = CompletionRequest {
            prompt,
            max_tokens: Some(2048),
            temperature: Some(0.7),
            ..Default::default()
        };

        let resp = client.send_request(req).await?;
        Ok(resp.choices.into_iter().next().map(|c| c.text).unwrap_or_default())
    }
}
