use crate::{McpError, Result};
use std::time::Instant;
use tokio::sync::Mutex;

pub struct SseTransport {
    url: String,
    session_id: Mutex<Option<String>>,
    client: reqwest::Client,
    next_id: Mutex<u64>,
}

impl SseTransport {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
            session_id: Mutex::new(None),
            client: reqwest::Client::new(),
            next_id: Mutex::new(1),
        }
    }

    pub async fn connect(&self) -> Result<()> {
        let response = self
            .client
            .get(&self.url)
            .header("Accept", "text/event-stream")
            .send()
            .await
            .map_err(|e| McpError::TransportError(format!("SSE connect failed: {}", e)))?;

        let session = response
            .headers()
            .get("x-session-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let mut guard = self.session_id.lock().await;
        *guard = Some(session);
        Ok(())
    }

    pub async fn disconnect(&self) -> Result<()> {
        let mut guard = self.session_id.lock().await;
        *guard = None;
        Ok(())
    }

    pub async fn send(&self, message: serde_json::Value) -> Result<serde_json::Value> {
        let session_id = {
            let guard = self.session_id.lock().await;
            guard.clone().ok_or_else(|| {
                McpError::TransportError("Not connected".to_string())
            })?
        };

        let session_url = format!("{}/session/{}", self.url.trim_end_matches('/'), session_id);

        let response = self
            .client
            .post(&session_url)
            .json(&message)
            .send()
            .await
            .map_err(|e| McpError::TransportError(format!("SSE send failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".to_string());
            return Err(McpError::TransportError(format!(
                "SSE request failed with status {}: {}",
                status, body
            )));
        }

        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|e| McpError::TransportError(format!("SSE response parse failed: {}", e)))?;

        Ok(result)
    }

    pub async fn ping(&self) -> Result<u64> {
        let id = {
            let mut next = self.next_id.lock().await;
            let id = *next;
            *next += 1;
            id
        };

        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "ping",
            "params": {}
        });

        let start = Instant::now();
        self.send(msg).await?;
        let elapsed = start.elapsed();

        Ok(elapsed.as_millis() as u64)
    }
}
