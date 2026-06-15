pub mod stdio;
pub mod sse;

use crate::Result;
use crate::TransportType;

pub enum Transport {
    Stdio(stdio::StdioTransport),
    Sse(sse::SseTransport),
}

impl Transport {
    pub async fn start(&self) -> Result<()> {
        match self {
            Transport::Stdio(t) => t.start().await,
            Transport::Sse(t) => t.connect().await,
        }
    }

    pub async fn stop(&self) -> Result<()> {
        match self {
            Transport::Stdio(t) => t.stop().await,
            Transport::Sse(t) => t.disconnect().await,
        }
    }

    pub async fn send(&self, message: serde_json::Value) -> Result<serde_json::Value> {
        match self {
            Transport::Stdio(t) => t.send(message).await,
            Transport::Sse(t) => t.send(message).await,
        }
    }

    pub async fn ping(&self) -> Result<u64> {
        match self {
            Transport::Stdio(t) => t.ping().await,
            Transport::Sse(t) => t.ping().await,
        }
    }
}

pub fn create_transport(
    transport_type: &TransportType,
    command: Option<&str>,
    args: &[String],
    url: Option<&str>,
    env: std::collections::HashMap<String, String>,
) -> Transport {
    match transport_type {
        TransportType::Stdio => {
            Transport::Stdio(stdio::StdioTransport::new(
                command.unwrap_or(""),
                args,
                env,
            ))
        }
        TransportType::Sse => {
            Transport::Sse(sse::SseTransport::new(url.unwrap_or("")))
        }
    }
}
