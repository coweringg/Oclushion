use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub struct HiveMetrics {
    inserts: AtomicU64,
    searches: AtomicU64,
    embedding_latencies: Mutex<Vec<f64>>,
    search_latencies: Mutex<Vec<f64>>,
}

impl HiveMetrics {
    pub fn new() -> Self {
        Self {
            inserts: AtomicU64::new(0),
            searches: AtomicU64::new(0),
            embedding_latencies: Mutex::new(Vec::new()),
            search_latencies: Mutex::new(Vec::new()),
        }
    }

    pub fn record_insert(&self) {
        self.inserts.fetch_add(1, Ordering::SeqCst);
    }

    pub fn record_search(&self) {
        self.searches.fetch_add(1, Ordering::SeqCst);
    }

    pub fn record_embedding_latency(&self, ms: f64) {
        let mut latencies = self.embedding_latencies.lock().unwrap();
        latencies.push(ms);
        if latencies.len() > 1000 {
            latencies.remove(0);
        }
    }

    pub fn record_search_latency(&self, ms: f64) {
        let mut latencies = self.search_latencies.lock().unwrap();
        latencies.push(ms);
        if latencies.len() > 1000 {
            latencies.remove(0);
        }
    }

    pub fn db_size(&self) -> u64 {
        0
    }

    pub fn total_insights(&self) -> u64 {
        self.inserts.load(Ordering::SeqCst)
    }

    pub fn avg_search_latency(&self) -> f64 {
        let latencies = self.search_latencies.lock().unwrap();
        if latencies.is_empty() {
            return 0.0;
        }
        latencies.iter().sum::<f64>() / latencies.len() as f64
    }
}
