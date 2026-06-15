use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlmGenerateRequest {
    pub provider: String,
    pub model: String,
    pub system_prompt: String,
    pub user_message: String,
    pub messages: Option<Vec<LlmMessage>>,
    pub temperature: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlmGenerateResponse {
    pub provider: String,
    pub model: String,
    pub content: String,
    pub latency_ms: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LlmStreamChunk {
    pub session_id: String,
    pub delta: String,
    pub finish_reason: Option<String>,
}

fn get_proxy_url() -> String {
    std::env::var("VITE_SANOSHIELD_PROXY_URL").unwrap_or_else(|_| "http://localhost:8080".to_string())
}

fn to_openai_messages(req: &LlmGenerateRequest) -> Vec<serde_json::Value> {
    let mut msgs = vec![serde_json::json!({
        "role": "system",
        "content": req.system_prompt
    })];

    if let Some(messages) = &req.messages {
        for msg in messages {
            if msg.role != "system" {
                msgs.push(serde_json::json!({
                    "role": msg.role,
                    "content": msg.content
                }));
            }
        }
    } else {
        msgs.push(serde_json::json!({
            "role": "user",
            "content": req.user_message
        }));
    }
    msgs
}

fn to_anthropic_messages(req: &LlmGenerateRequest) -> Vec<serde_json::Value> {
    let mut msgs = Vec::new();
    if let Some(messages) = &req.messages {
        for msg in messages {
            if msg.role != "system" {
                let role = if msg.role == "assistant" { "assistant" } else { "user" };
                msgs.push(serde_json::json!({
                    "role": role,
                    "content": msg.content
                }));
            }
        }
    } else {
        msgs.push(serde_json::json!({
            "role": "user",
            "content": req.user_message
        }));
    }
    msgs
}

fn build_payload(req: &LlmGenerateRequest, stream: bool) -> (String, serde_json::Value) {
    if req.provider == "anthropic" {
        let mut payload = serde_json::json!({
            "model": req.model,
            "max_tokens": 4096,
            "system": req.system_prompt,
            "messages": to_anthropic_messages(req),
        });
        if stream {
            payload["stream"] = serde_json::json!(true);
        }
        (format!("{}/v1/messages", get_proxy_url()), payload)
    } else {
        let mut payload = serde_json::json!({
            "model": req.model,
            "messages": to_openai_messages(req),
            "temperature": req.temperature,
        });
        if stream {
            payload["stream"] = serde_json::json!(true);
        }
        (format!("{}/v1/chat/completions", get_proxy_url()), payload)
    }
}

#[tauri::command]
pub async fn llm_generate(req: LlmGenerateRequest) -> Result<LlmGenerateResponse, String> {
    let api_key = match crate::keychain::load_api_key(req.provider.clone())? {
        Some(k) => k,
        None => return Err(format!("No API key found for provider {}", req.provider)),
    };

    let client = reqwest::Client::new();
    let (url, payload) = build_payload(&req, false);
    
    let start = Instant::now();
    let mut request_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Oclushion-Source", "desktop-shell-rust")
        .json(&payload);

    if req.provider == "anthropic" {
        request_builder = request_builder
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Provider API error ({}): {}", status, text));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    let content = if req.provider == "anthropic" {
        let text = json["content"]
            .as_array()
            .and_then(|c| c.first())
            .and_then(|c| c["text"].as_str())
            .unwrap_or_default()
            .to_string();
        text
    } else {
        json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    };

    Ok(LlmGenerateResponse {
        provider: req.provider.clone(),
        model: req.model,
        content,
        latency_ms: start.elapsed().as_millis() as u32,
    })
}

#[tauri::command]
pub async fn llm_stream(
    app: AppHandle,
    session_id: String,
    req: LlmGenerateRequest,
) -> Result<(), String> {
    let api_key = match crate::keychain::load_api_key(req.provider.clone())? {
        Some(k) => k,
        None => return Err(format!("No API key found for provider {}", req.provider)),
    };

    let client = reqwest::Client::new();
    let (url, payload) = build_payload(&req, true);
    
    let mut request_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Oclushion-Source", "desktop-shell-rust")
        .json(&payload);

    if req.provider == "anthropic" {
        request_builder = request_builder
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Provider API error ({}): {}", status, text));
    }

    use futures_util::StreamExt;

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(newline_idx) = buffer.find('\n') {
            let line = buffer[..newline_idx].trim().to_string();
            buffer.drain(..=newline_idx);

            if line.starts_with("data: ") {
                let data = &line[6..];
                
                if req.provider == "anthropic" {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        let event_type = parsed["type"].as_str().unwrap_or_default();
                        
                        if event_type == "content_block_delta" {
                            let delta = parsed["delta"]["text"].as_str().unwrap_or_default().to_string();
                            if !delta.is_empty() {
                                let _ = app.emit("llm:stream", LlmStreamChunk {
                                    session_id: session_id.clone(),
                                    delta,
                                    finish_reason: None,
                                });
                            }
                        } else if event_type == "message_stop" {
                            let _ = app.emit("llm:stream", LlmStreamChunk {
                                session_id: session_id.clone(),
                                delta: String::new(),
                                finish_reason: Some("stop".to_string()),
                            });
                            return Ok(());
                        } else if event_type == "message_delta" {
                            if let Some(stop_reason) = parsed["delta"]["stop_reason"].as_str() {
                                if stop_reason == "max_tokens" {
                                    let _ = app.emit("llm:stream", LlmStreamChunk {
                                        session_id: session_id.clone(),
                                        delta: String::new(),
                                        finish_reason: Some("length".to_string()),
                                    });
                                    return Ok(());
                                }
                            }
                        }
                    }
                } else {
                    if data == "[DONE]" {
                        let _ = app.emit("llm:stream", LlmStreamChunk {
                            session_id: session_id.clone(),
                            delta: String::new(),
                            finish_reason: Some("stop".to_string()),
                        });
                        return Ok(());
                    }

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = parsed["choices"].as_array() {
                            if let Some(choice) = choices.first() {
                                let delta = choice["delta"]["content"].as_str().unwrap_or_default().to_string();
                                let finish_reason = choice["finish_reason"].as_str().map(|s| s.to_string());
                                
                                if !delta.is_empty() || finish_reason.is_some() {
                                    let _ = app.emit("llm:stream", LlmStreamChunk {
                                        session_id: session_id.clone(),
                                        delta,
                                        finish_reason,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}