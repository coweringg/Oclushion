use crate::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheStats {
    pub entries: u64,
    pub size_bytes: u64,
    pub hits: u64,
    pub misses: u64,
}

pub struct WasmCache {
    cache_dir: PathBuf,
    stats: Mutex<CacheStats>,
    memory_cache: Mutex<HashMap<String, Vec<u8>>>,
}

impl WasmCache {
    pub fn new(cache_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&cache_dir);
        WasmCache {
            cache_dir,
            stats: Mutex::new(CacheStats::default()),
            memory_cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_or_compute<F>(&self, key: &str, compute: F) -> Result<Vec<u8>>
    where
        F: Fn() -> Result<Vec<u8>>,
    {
        let hash = self.hash_key(key);

        if let Some(cached) = self.get(&hash) {
            return Ok(cached);
        }

        let wasm_bytes = compute()?;
        self.set(&hash, wasm_bytes.clone());
        Ok(wasm_bytes)
    }

    pub fn get(&self, hash: &str) -> Option<Vec<u8>> {
        {
            let mem = self.memory_cache.lock().unwrap();
            if let Some(bytes) = mem.get(hash) {
                let mut stats = self.stats.lock().unwrap();
                stats.hits += 1;
                return Some(bytes.clone());
            }
        }

        let path = self.cache_dir.join(format!("{}.bin", hash));
        if path.exists() {
            match std::fs::read(&path) {
                Ok(bytes) => {
                    let mut stats = self.stats.lock().unwrap();
                    stats.hits += 1;
                    let mut mem = self.memory_cache.lock().unwrap();
                    mem.insert(hash.to_string(), bytes.clone());
                    Some(bytes)
                }
                Err(_) => None,
            }
        } else {
            let mut stats = self.stats.lock().unwrap();
            stats.misses += 1;
            None
        }
    }

    pub fn set(&self, hash: &str, wasm_bytes: Vec<u8>) {
        let path = self.cache_dir.join(format!("{}.bin", hash));
        let size = wasm_bytes.len() as u64;
        if let Err(e) = std::fs::write(&path, &wasm_bytes) {
            eprintln!("cache write error: {}", e);
        }

        let mut stats = self.stats.lock().unwrap();
        stats.entries += 1;
        stats.size_bytes += size;

        let mut mem = self.memory_cache.lock().unwrap();
        mem.insert(hash.to_string(), wasm_bytes);
    }

    pub fn invalidate(&self, hash: &str) {
        let path = self.cache_dir.join(format!("{}.bin", hash));
        let _ = std::fs::remove_file(&path);
        let mut mem = self.memory_cache.lock().unwrap();
        if let Some(bytes) = mem.remove(hash) {
            let mut stats = self.stats.lock().unwrap();
            stats.entries = stats.entries.saturating_sub(1);
            stats.size_bytes = stats.size_bytes.saturating_sub(bytes.len() as u64);
        }
    }

    pub fn clear(&self) {
        if let Ok(entries) = std::fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "bin") {
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
        let mut mem = self.memory_cache.lock().unwrap();
        mem.clear();
        let mut stats = self.stats.lock().unwrap();
        *stats = CacheStats::default();
    }

    pub fn stats(&self) -> CacheStats {
        let stats = self.stats.lock().unwrap();
        stats.clone()
    }

    fn hash_key(&self, key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        hex::encode(hasher.finalize())
    }
}
