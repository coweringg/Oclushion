use std::time::Duration;
use tokio::sync::mpsc::{self, Receiver};
use crate::{CompletionRequest, CompletionResponse, InferenceError};

pub struct IpcClient {
    base_url: String,
    client: reqwest::Client,
}

impl IpcClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
        }
    }

    pub async fn send_request(&self, req: CompletionRequest) -> Result<CompletionResponse, InferenceError> {
        let url = format!("{}/completion", self.base_url);

        let mut body = serde_json::json!({
            "prompt": req.prompt,
        });

        if let Some(max_tokens) = req.max_tokens {
            body["n_predict"] = serde_json::json!(max_tokens);
        }
        if let Some(temperature) = req.temperature {
            body["temperature"] = serde_json::json!(temperature);
        }
        if let Some(top_p) = req.top_p {
            body["top_p"] = serde_json::json!(top_p);
        }
        if let Some(stop) = &req.stop {
            body["stop"] = serde_json::json!(stop);
        }
        if let Some(suffix) = &req.suffix {
            let fim_body = serde_json::json!({
                "input_prefix": req.prompt,
                "input_suffix": suffix,
            });
            body = fim_body;
        }
        body["stream"] = serde_json::json!(false);

        let resp = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| InferenceError::HttpRequestFailed(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(InferenceError::HttpRequestFailed(format!("HTTP {}: {}", status, text)));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| InferenceError::ParseError(format!("JSON parse: {}", e)))?;

        let content = json["content"].as_str().unwrap_or("").to_string();
        let model = json["model"].as_str().unwrap_or("unknown").to_string();
        let id = json["id"].as_str().unwrap_or("unknown").to_string();
        let tokens_evaluated = json["tokens_evaluated"].as_u64().unwrap_or(0) as u32;
        let tokens_predicted = json["tokens_predicted"].as_u64().unwrap_or(0) as u32;

        Ok(CompletionResponse {
            id,
            model,
            choices: vec![crate::Choice {
                index: 0,
                text: content,
                finish_reason: json["stop_type"].as_str().map(|s| s.to_string()),
            }],
            usage: Some(crate::Usage {
                prompt_tokens: tokens_evaluated,
                completion_tokens: tokens_predicted,
                total_tokens: tokens_evaluated + tokens_predicted,
            }),
        })
    }

    pub async fn send_streaming(
        &self,
        req: CompletionRequest,
    ) -> Result<Receiver<String>, InferenceError> {
        let url = format!("{}/completion", self.base_url);

        let mut body = serde_json::json!({
            "prompt": req.prompt,
            "stream": true,
        });

        if let Some(max_tokens) = req.max_tokens {
            body["n_predict"] = serde_json::json!(max_tokens);
        }
        if let Some(temperature) = req.temperature {
            body["temperature"] = serde_json::json!(temperature);
        }
        if let Some(top_p) = req.top_p {
            body["top_p"] = serde_json::json!(top_p);
        }

        let resp = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| InferenceError::HttpRequestFailed(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(InferenceError::HttpRequestFailed(format!("HTTP {}: {}", status, text)));
        }

        let (tx, rx) = mpsc::channel::<String>(1024);
        let stream = resp.bytes_stream();

        tokio::spawn(async move {
            use tokio_stream::StreamExt;
            let mut stream = stream;
            let mut buffer = String::new();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        let text = String::from_utf8_lossy(&bytes);
                        buffer.push_str(&text);

                        while let Some(pos) = buffer.find('\n') {
                            let line = buffer[..pos].trim().to_string();
                            buffer = buffer[pos + 1..].to_string();

                            if let Some(token) = parse_sse_line(&line) {
                                if tx.try_send(token).is_err() {
                                    return;
                                }
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(rx)
    }
}

fn parse_sse_line(line: &str) -> Option<String> {
    if !line.starts_with("data: ") {
        return None;
    }
    let data = line.strip_prefix("data: ")?;
    if data == "[DONE]" {
        return None;
    }
    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    json["content"].as_str().map(|s| s.to_string())
}
