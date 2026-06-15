use std::collections::HashMap;
use std::sync::Mutex;

struct CacheEntry {
    value: String,
    last_access: std::time::Instant,
}

pub struct PromptCache {
    inner: Mutex<PromptCacheInner>,
}

struct PromptCacheInner {
    entries: HashMap<String, CacheEntry>,
    capacity: usize,
}

impl PromptCache {
    pub fn new() -> Self {
        Self::with_capacity(10000)
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(PromptCacheInner {
                entries: HashMap::new(),
                capacity,
            }),
        }
    }

    pub fn get_or_compute<F>(&self, key: &str, compute: F) -> String
    where
        F: FnOnce() -> String,
    {
        let mut inner = self.inner.lock().expect("cache lock");

        if let Some(entry) = inner.entries.get_mut(key) {
            entry.last_access = std::time::Instant::now();
            return entry.value.clone();
        }

        if inner.entries.len() >= inner.capacity {
            if let Some(evict_key) = inner.entries.iter()
                .min_by_key(|(_, v)| v.last_access)
                .map(|(k, _)| k.clone())
            {
                inner.entries.remove(&evict_key);
            }
        }

        let value = compute();
        inner.entries.insert(key.to_string(), CacheEntry {
            value: value.clone(),
            last_access: std::time::Instant::now(),
        });
        value
    }

    pub fn invalidate(&self, key: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.remove(key);
        }
    }

    pub fn clear(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.clear();
        }
    }

    pub fn len(&self) -> usize {
        self.inner.lock().map(|i| i.entries.len()).unwrap_or(0)
    }
}
