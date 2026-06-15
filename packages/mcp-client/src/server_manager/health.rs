use crate::server_manager::lifecycle::ServerLifecycle;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};
use tokio::time::sleep;

pub struct HealthMonitor {
    interval_secs: u64,
    last_ping: Arc<RwLock<HashMap<String, u64>>>,
    running: Arc<Mutex<bool>>,
}

impl HealthMonitor {
    pub fn new(interval_secs: u64) -> Self {
        Self {
            interval_secs,
            last_ping: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self, lifecycle: Arc<ServerLifecycle>) {
        let mut running_guard = self.running.lock().await;
        if *running_guard {
            return;
        }
        *running_guard = true;
        drop(running_guard);

        let interval = Duration::from_secs(self.interval_secs);
        let running = self.running.clone();
        let last_ping = self.last_ping.clone();

        tokio::spawn(async move {
            loop {
                {
                    let guard = running.lock().await;
                    if !*guard {
                        break;
                    }
                }

                let servers = lifecycle.running_servers().await;
                for name in &servers {
                    match lifecycle.send_message(name, serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": 0u64,
                        "method": "ping",
                        "params": {}
                    })).await {
                        Ok(_) => {
                            let mut lp = last_ping.write().await;
                            lp.insert(name.clone(), Instant::now().elapsed().as_millis() as u64);
                        }
                        Err(_) => {
                            let mut retries = 0;
                            while retries < 3 {
                                sleep(Duration::from_secs(1)).await;
                                retries += 1;
                                if lifecycle.restart_server(name).await.is_ok() {
                                    break;
                                }
                            }
                        }
                    }
                }

                sleep(interval).await;
            }
        });
    }

    pub async fn stop(&self) {
        let mut guard = self.running.lock().await;
        *guard = false;
    }

    pub async fn check_server(&self, name: &str) -> bool {
        let lp = self.last_ping.read().await;
        lp.contains_key(name)
    }

    pub async fn check_all(&self) -> HashMap<String, bool> {
        let lp = self.last_ping.read().await;
        let servers: Vec<String> = lp.keys().cloned().collect();
        let mut result = HashMap::new();
        for s in servers {
            result.insert(s.clone(), lp.contains_key(&s));
        }
        result
    }

    pub async fn update_ping(&self, server: &str, ms: u64) {
        let mut lp = self.last_ping.write().await;
        lp.insert(server.to_string(), ms);
    }
}
