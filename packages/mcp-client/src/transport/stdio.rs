use crate::{McpError, Result};
use std::collections::HashMap;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

pub struct StdioTransport {
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    inner: Mutex<Option<StdioInner>>,
    next_id: Mutex<u64>,
}

struct StdioInner {
    stdin: tokio::process::ChildStdin,
    stdout: Option<tokio::process::ChildStdout>,
    pid: u32,
}

impl StdioTransport {
    pub fn new(command: &str, args: &[String], env: HashMap<String, String>) -> Self {
        Self {
            command: command.to_string(),
            args: args.to_vec(),
            env,
            inner: Mutex::new(None),
            next_id: Mutex::new(1),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let mut cmd = Command::new(&self.command);
        cmd.args(&self.args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        for (k, v) in &self.env {
            cmd.env(k, v);
        }

        let mut child = cmd.spawn().map_err(|e| {
            McpError::TransportError(format!("Failed to spawn process '{}': {}", self.command, e))
        })?;

        let pid = child
            .id()
            .ok_or_else(|| McpError::TransportError("No PID assigned".to_string()))?;

        let stdin = child.stdin.take().ok_or_else(|| {
            McpError::TransportError("Failed to capture stdin".to_string())
        })?;

        let stdout = child.stdout.take().ok_or_else(|| {
            McpError::TransportError("Failed to capture stdout".to_string())
        })?;

        let mut guard = self.inner.lock().await;
        *guard = Some(StdioInner {
            stdin,
            stdout: Some(stdout),
            pid,
        });

        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        let mut guard = self.inner.lock().await;
        *guard = None;
        Ok(())
    }

    pub async fn send(&self, message: serde_json::Value) -> Result<serde_json::Value> {
        let mut guard = self.inner.lock().await;
        let inner = guard.as_mut().ok_or_else(|| {
            McpError::TransportError("Process not started".to_string())
        })?;

        let line = serde_json::to_string(&message)?;
        inner.stdin.write_all(line.as_bytes()).await?;
        inner.stdin.write_all(b"\n").await?;
        inner.stdin.flush().await?;

        let stdout_val = inner.stdout.take().ok_or_else(|| {
            McpError::TransportError("stdout not available".to_string())
        })?;

        let mut reader = BufReader::new(stdout_val);
        let mut response_line = String::new();
        reader.read_line(&mut response_line).await?;

        let trimmed = response_line.trim();
        if trimmed == "READY" || trimmed.is_empty() {
            response_line.clear();
            reader.read_line(&mut response_line).await?;
        }

        let recovered = reader.into_inner();
        inner.stdout = Some(recovered);

        let response: serde_json::Value = serde_json::from_str(response_line.trim())?;
        Ok(response)
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

    pub fn pid(&self) -> u32 {
        let guard = self.inner.try_lock();
        guard
            .ok()
            .and_then(|g| g.as_ref().map(|i| i.pid))
            .unwrap_or(0)
    }
}
