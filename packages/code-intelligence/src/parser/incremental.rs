use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

use dashmap::DashMap;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use sha2::{Digest, Sha256};
use tokio::sync::mpsc;

use crate::parser::ast_cache::{CachedSource, SourceCache};
use crate::{CodeIntelError, Result, MAX_FILE_SIZE, SUPPORTED_EXTENSIONS};

pub struct IncrementalParser {
    cache: Arc<SourceCache>,
    hash_cache: DashMap<String, [u8; 32]>,
}

impl IncrementalParser {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(SourceCache::new()),
            hash_cache: DashMap::new(),
        }
    }

    pub fn watch<P: AsRef<Path>>(&mut self, path: P) -> Result<mpsc::UnboundedReceiver<Event>> {
        let (tx, rx) = mpsc::unbounded_channel();
        let tx_clone = tx.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: std::result::Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx_clone.send(event);
                }
            },
            Config::default(),
        )
        .map_err(|e| CodeIntelError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        watcher
            .watch(path.as_ref(), RecursiveMode::Recursive)
            .map_err(|e| CodeIntelError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        Ok(rx)
    }

    pub fn is_supported(path: &Path) -> bool {
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| SUPPORTED_EXTENSIONS.contains(&e))
            .unwrap_or(false)
    }

    pub fn parse_file(&self, path: &Path) -> Result<CachedSource> {
        let metadata = std::fs::metadata(path)
            .map_err(|_| CodeIntelError::FileNotFound(path.to_path_buf()))?;
        if metadata.len() > MAX_FILE_SIZE {
            return Err(CodeIntelError::FileTooLarge(metadata.len()));
        }

        let source = std::fs::read_to_string(path)?;
        let hash = Self::hash(&source);
        let path_str = path.to_string_lossy().to_string();

        if let Some(cached) = self.cache.get(&path_str) {
            if cached.hash == hash {
                return Ok(cached);
            }
        }

        let _start = Instant::now();

        let cached = CachedSource {
            hash,
            source: Arc::new(source),
            path: path.to_path_buf(),
        };
        self.hash_cache.insert(path_str.clone(), hash);
        self.cache.insert(path_str, cached.clone());
        Ok(cached)
    }

    pub fn reparse_changed_sync(&self, paths: &[PathBuf]) -> Vec<Result<CachedSource>> {
        let mut results = Vec::new();
        for path in paths {
            if !Self::is_supported(path) {
                continue;
            }
            if let Ok(source) = std::fs::read_to_string(path) {
                let hash = Self::hash(&source);
                let key = path.to_string_lossy().to_string();
                let changed = self.hash_cache.get(&key).map(|h| *h != hash).unwrap_or(true);
                if changed {
                    results.push(self.parse_file(path));
                }
            }
        }
        results
    }

    pub fn hash(source: &str) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(source.as_bytes());
        let result = hasher.finalize();
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&result);
        arr
    }

    pub fn cache(&self) -> &Arc<SourceCache> {
        &self.cache
    }
}
