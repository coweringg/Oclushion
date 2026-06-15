use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub struct InferenceMetrics {
    latencies: Mutex<Vec<f64>>,
    token_rates: Mutex<Vec<f64>>,
    total_inferences: AtomicU64,
}

impl InferenceMetrics {
    pub fn new() -> Self {
        Self {
            latencies: Mutex::new(Vec::with_capacity(1000)),
            token_rates: Mutex::new(Vec::with_capacity(1000)),
            total_inferences: AtomicU64::new(0),
        }
    }

    pub fn record_latency(&self, ms: f64) {
        if let Ok(mut latencies) = self.latencies.lock() {
            latencies.push(ms);
            if latencies.len() > 10000 {
                latencies.remove(0);
            }
        }
    }

    pub fn record_tokens_per_second(&self, tps: f64) {
        if let Ok(mut rates) = self.token_rates.lock() {
            rates.push(tps);
            if rates.len() > 10000 {
                rates.remove(0);
            }
        }
        self.total_inferences.fetch_add(1, Ordering::SeqCst);
    }

    pub fn average_latency(&self) -> f64 {
        self.latencies.lock()
            .ok()
            .filter(|l| !l.is_empty())
            .map(|l| l.iter().sum::<f64>() / l.len() as f64)
            .unwrap_or(0.0)
    }

    pub fn tokens_per_second(&self) -> f64 {
        self.token_rates.lock()
            .ok()
            .filter(|r| !r.is_empty())
            .map(|r| r.iter().sum::<f64>() / r.len() as f64)
            .unwrap_or(0.0)
    }

    pub fn total_inferences(&self) -> u64 {
        self.total_inferences.load(Ordering::SeqCst)
    }
}
