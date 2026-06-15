use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;
use crate::ModelError;

pub struct ModelDownloader {
    progress: Arc<AtomicU64>,
    total_bytes: Arc<AtomicU64>,
}

impl ModelDownloader {
    pub fn new() -> Self {
        Self {
            progress: Arc::new(AtomicU64::new(0)),
            total_bytes: Arc::new(AtomicU64::new(0)),
        }
    }

    pub async fn download(&self, url: &str, dest: &Path) -> Result<PathBuf, ModelError> {
        let client = reqwest::Client::builder()
            .build()
            .map_err(|e| ModelError::DownloadFailed(format!("Client build: {}", e)))?;

        let existing_size = if dest.exists() {
            std::fs::metadata(dest)
                .map(|m| m.len())
                .unwrap_or(0)
        } else {
            0
        };

        let mut request = client.get(url);
        if existing_size > 0 {
            request = request.header("Range", format!("bytes={}-", existing_size));
        }

        let resp = request
            .send()
            .await
            .map_err(|e| ModelError::DownloadFailed(format!("HTTP request: {}", e)))?;

        if !resp.status().is_success() && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            return Err(ModelError::DownloadFailed(format!("HTTP {}", resp.status())));
        }

        let total = resp.content_length().unwrap_or(0) + existing_size;
        self.total_bytes.store(total, Ordering::SeqCst);
        self.progress.store(existing_size, Ordering::SeqCst);

        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dest)
            .await
            .map_err(|e| ModelError::DownloadFailed(format!("File open: {}", e)))?;

        let mut stream = resp.bytes_stream();
        use tokio_stream::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| ModelError::DownloadFailed(format!("Stream: {}", e)))?;
            use tokio::io::AsyncWriteExt;
            file.write_all(&chunk)
                .await
                .map_err(|e| ModelError::DownloadFailed(format!("Write: {}", e)))?;
            self.progress.fetch_add(chunk.len() as u64, Ordering::SeqCst);
        }

        file.flush().await.map_err(|e| ModelError::DownloadFailed(format!("Flush: {}", e)))?;

        Ok(dest.to_path_buf())
    }

    pub fn verify_sha256(&self, path: &Path, expected_sha: &str) -> Result<bool, ModelError> {
        let data = std::fs::read(path)
            .map_err(|e| ModelError::StorageError(format!("Read for SHA256: {}", e)))?;

        let mut hasher = Sha256::new();
        hasher.update(&data);
        let actual = hex::encode(hasher.finalize());

        Ok(actual == expected_sha)
    }

    pub fn get_progress(&self) -> f64 {
        let total = self.total_bytes.load(Ordering::SeqCst);
        if total == 0 {
            return 0.0;
        }
        let current = self.progress.load(Ordering::SeqCst);
        current as f64 / total as f64
    }
}
