use sha2::{Digest, Sha256};
use crate::{EmbeddingConfig, EmbeddingError};

pub struct OnnxRuntime {
    _config: EmbeddingConfig,
}

impl OnnxRuntime {
    pub fn load_model(path: &str) -> Self {
        Self {
            _config: EmbeddingConfig {
                model_path: path.to_string(),
                ..EmbeddingConfig::default()
            },
        }
    }

    pub fn embed(&self, text: &str) -> Result<Vec<f32>, EmbeddingError> {
        Ok(compute_simulated_embedding(text))
    }

    pub fn embed_batch(&self, texts: Vec<&str>) -> Result<Vec<Vec<f32>>, EmbeddingError> {
        let results: Vec<Vec<f32>> = texts
            .iter()
            .map(|t| compute_simulated_embedding(t))
            .collect();
        Ok(results)
    }
}

pub(crate) fn compute_simulated_embedding(text: &str) -> Vec<f32> {
    let mut hash = Sha256::digest(text.as_bytes());
    let mut vec = Vec::with_capacity(384);
    for i in 0..384 {
        let byte_idx = (i * 8) % 32;
        let val = (hash[byte_idx] as f32) / 255.0 * 2.0 - 1.0;
        vec.push(val);
        if byte_idx == 24 {
            hash = Sha256::digest(&hash);
        }
    }
    let norm: f32 = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in vec.iter_mut() {
            *v /= norm;
        }
    }
    vec
}
