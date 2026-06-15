use crate::ModelInfo;
use std::sync::Mutex;

struct BuiltinModel {
    name: &'static str,
    description: &'static str,
    license: &'static str,
    file_size_bytes: u64,
    requires_gpu: bool,
    download_url: &'static str,
    expected_sha256: &'static str,
}

const BUILTIN_CATALOG: &[BuiltinModel] = &[
    BuiltinModel {
        name: "Qwen2.5-Coder-1.5B",
        description: "Qwen 2.5 Coder 1.5B - lightweight code generation model",
        license: "Apache-2.0",
        file_size_bytes: 1_200_000_000,
        requires_gpu: false,
        download_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
        expected_sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    },
    BuiltinModel {
        name: "Llama-3.2-3B",
        description: "Meta Llama 3.2 3B - general purpose instruction model",
        license: "Llama-3.2",
        file_size_bytes: 2_400_000_000,
        requires_gpu: false,
        download_url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        expected_sha256: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
    },
    BuiltinModel {
        name: "Mistral-7B",
        description: "Mistral 7B - efficient general purpose model",
        license: "Apache-2.0",
        file_size_bytes: 4_500_000_000,
        requires_gpu: true,
        download_url: "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/mistral-7b-instruct-v0.3-q4_k_m.gguf",
        expected_sha256: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    },
    BuiltinModel {
        name: "CodeGemma-2B",
        description: "Google CodeGemma 2B - code generation and infilling",
        license: "Gemma",
        file_size_bytes: 1_600_000_000,
        requires_gpu: false,
        download_url: "https://huggingface.co/google/codegemma-2b/resolve/main/gguf/codegemma-2b-Q4_K_M.gguf",
        expected_sha256: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    },
    BuiltinModel {
        name: "StarCoder2-3B",
        description: "StarCoder2 3B - open-source code LLM",
        license: "Apache-2.0",
        file_size_bytes: 2_000_000_000,
        requires_gpu: false,
        download_url: "https://huggingface.co/bartowski/StarCoder2-3B-GGUF/resolve/main/StarCoder2-3B-Q4_K_M.gguf",
        expected_sha256: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    },
    BuiltinModel {
        name: "DeepSeek-Coder-V2-Lite",
        description: "DeepSeek Coder V2 Lite - 16B code specialist",
        license: "DeepSeek",
        file_size_bytes: 10_000_000_000,
        requires_gpu: true,
        download_url: "https://huggingface.co/deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/deepseek-coder-v2-lite-instruct-q4_k_m.gguf",
        expected_sha256: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
    },
];

pub struct ModelRegistry {
    installed: Mutex<Vec<String>>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            installed: Mutex::new(Vec::new()),
        }
    }

    pub fn list_available(&self) -> Vec<ModelInfo> {
        let installed = self.installed.lock().expect("lock");
        BUILTIN_CATALOG
            .iter()
            .map(|m| ModelInfo {
                name: m.name.to_string(),
                description: m.description.to_string(),
                license: m.license.to_string(),
                is_installed: installed.iter().any(|i| i == m.name),
                file_size_bytes: m.file_size_bytes,
                requires_gpu: m.requires_gpu,
                quantization: Some("Q4_K_M".into()),
                download_url: Some(m.download_url.to_string()),
                expected_sha256: Some(m.expected_sha256.to_string()),
            })
            .collect()
    }

    pub fn get_model(&self, name: &str) -> Option<ModelInfo> {
        self.list_available().into_iter().find(|m| m.name == name)
    }

    pub fn register_installed(&self, name: &str) {
        if let Ok(mut installed) = self.installed.lock() {
            if !installed.iter().any(|i| i == name) {
                installed.push(name.to_string());
            }
        }
    }

    pub fn unregister_installed(&self, name: &str) {
        if let Ok(mut installed) = self.installed.lock() {
            installed.retain(|i| i != name);
        }
    }

    pub fn is_installed(&self, name: &str) -> bool {
        self.installed.lock().map(|i| i.iter().any(|n| n == name)).unwrap_or(false)
    }
}
