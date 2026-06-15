use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::ConfigError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalInferenceConfig {
    pub models_dir: PathBuf,
    pub preferred_model: String,
    pub port: u16,
    pub max_tokens: u32,
    pub temperature: f64,
    pub top_p: f64,
    pub gpu_layers: u32,
    pub context_size: u32,
    pub auto_start: bool,
}

impl Default for LocalInferenceConfig {
    fn default() -> Self {
        Self {
            models_dir: PathBuf::from("models"),
            preferred_model: "Qwen2.5-Coder-1.5B".into(),
            port: 8080,
            max_tokens: 4096,
            temperature: 0.7,
            top_p: 0.9,
            gpu_layers: 0,
            context_size: 4096,
            auto_start: true,
        }
    }
}

impl LocalInferenceConfig {
    pub fn config_path() -> PathBuf {
        let mut path = PathBuf::new();
        if let Ok(dir) = std::env::var("LOCAL_INFERENCE_CONFIG_DIR") {
            path = PathBuf::from(dir);
        } else if let Ok(home) = std::env::var("HOME") {
            path = PathBuf::from(home).join(".config").join("oclushion");
        } else if let Ok(home) = std::env::var("USERPROFILE") {
            path = PathBuf::from(home).join(".config").join("oclushion");
        }
        path.join("local-inference.json")
    }

    pub fn load() -> Result<Self, ConfigError> {
        let path = Self::config_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let data = std::fs::read_to_string(&path)
            .map_err(|e| ConfigError::ReadFailed(format!("Cannot read {}: {}", path.display(), e)))?;
        serde_json::from_str(&data)
            .map_err(|e| ConfigError::InvalidConfig(format!("Invalid JSON: {}", e)))
    }

    pub fn save(&self) -> Result<(), ConfigError> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| ConfigError::WriteFailed(format!("Cannot create dir: {}", e)))?;
        }
        let data = serde_json::to_string_pretty(self)
            .map_err(|e| ConfigError::WriteFailed(format!("Serialize: {}", e)))?;
        std::fs::write(&path, data)
            .map_err(|e| ConfigError::WriteFailed(format!("Cannot write {}: {}", path.display(), e)))?;
        Ok(())
    }

    pub fn get_model_path(&self) -> PathBuf {
        self.models_dir.join(format!("{}.gguf", self.preferred_model))
    }

    pub fn get_preferred_model(&self) -> &str {
        &self.preferred_model
    }
}
