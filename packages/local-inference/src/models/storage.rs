use std::path::PathBuf;
use crate::{ModelError, ModelInfo};

pub struct ModelStorage {
    models_dir: PathBuf,
}

impl ModelStorage {
    pub fn new(models_dir: PathBuf) -> Self {
        Self { models_dir }
    }

    pub fn get_models_dir(&self) -> PathBuf {
        self.models_dir.clone()
    }

    pub fn list_installed(&self) -> Result<Vec<ModelInfo>, ModelError> {
        let mut models = Vec::new();

        if !self.models_dir.exists() {
            return Ok(models);
        }

        for entry in std::fs::read_dir(&self.models_dir)
            .map_err(|e| ModelError::StorageError(format!("Read dir: {}", e)))?
        {
            let entry = entry.map_err(|e| ModelError::StorageError(format!("Entry: {}", e)))?;
            let path = entry.path();

            if path.extension().map_or(false, |ext| ext == "gguf") {
                let metadata = std::fs::metadata(&path)
                    .map_err(|e| ModelError::StorageError(format!("Metadata: {}", e)))?;

                let name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                models.push(ModelInfo {
                    name,
                    description: String::new(),
                    license: String::new(),
                    is_installed: true,
                    file_size_bytes: metadata.len(),
                    requires_gpu: false,
                    quantization: None,
                    download_url: None,
                    expected_sha256: None,
                });
            }
        }

        Ok(models)
    }

    pub fn delete_model(&self, name: &str) -> Result<(), ModelError> {
        let path = self.models_dir.join(format!("{}.gguf", name));
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| ModelError::StorageError(format!("Delete failed: {}", e)))?;
        }

        let qwen_path = self.models_dir.join(format!("{}.gguf", name.to_lowercase()));
        if qwen_path.exists() {
            std::fs::remove_file(&qwen_path)
                .map_err(|e| ModelError::StorageError(format!("Delete failed: {}", e)))?;
        }

        Ok(())
    }

    pub fn get_disk_usage(&self) -> Result<u64, ModelError> {
        let mut total = 0u64;

        if !self.models_dir.exists() {
            return Ok(0);
        }

        for entry in std::fs::read_dir(&self.models_dir)
            .map_err(|e| ModelError::StorageError(format!("Read dir: {}", e)))?
        {
            let entry = entry.map_err(|e| ModelError::StorageError(format!("Entry: {}", e)))?;
            let path = entry.path();

            if path.extension().map_or(false, |ext| ext == "gguf") {
                if let Ok(meta) = std::fs::metadata(&path) {
                    total += meta.len();
                }
            }
        }

        Ok(total)
    }
}
