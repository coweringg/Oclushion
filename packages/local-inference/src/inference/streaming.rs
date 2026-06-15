use tokio::sync::mpsc::Receiver;
use tokio_stream::wrappers::ReceiverStream;

pub struct StreamHandler;

impl StreamHandler {
    pub fn stream_tokens(rx: Receiver<String>) -> ReceiverStream<String> {
        ReceiverStream::new(rx)
    }

    pub async fn collect_string(mut rx: Receiver<String>) -> String {
        let mut result = String::new();
        while let Some(token) = rx.recv().await {
            result.push_str(&token);
        }
        result
    }

    pub async fn collect_tokens(mut rx: Receiver<String>) -> Vec<String> {
        let mut tokens = Vec::new();
        while let Some(token) = rx.recv().await {
            tokens.push(token);
        }
        tokens
    }
}
