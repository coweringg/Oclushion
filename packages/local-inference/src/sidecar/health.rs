use std::time::Duration;
use crate::SidecarError;

#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded(String),
    Unhealthy(String),
    Unknown,
}

pub struct SidecarHealth {
    base_url: String,
    client: reqwest::blocking::Client,
}

impl SidecarHealth {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
        }
    }

    pub fn check_health(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        self.client.get(&url).send().ok().map_or(false, |resp| resp.status().is_success())
    }

    pub fn wait_for_ready(&self, timeout: Duration) -> Result<(), SidecarError> {
        let start = std::time::Instant::now();
        while start.elapsed() < timeout {
            if self.check_health() {
                return Ok(());
            }
            std::thread::sleep(Duration::from_millis(200));
        }
        Err(SidecarError::Timeout(format!(
            "Sidecar did not become ready within {:?}",
            timeout
        )))
    }

    pub fn get_status(&self) -> HealthStatus {
        let url = format!("{}/health", self.base_url);
        match self.client.get(&url).send() {
            Ok(resp) if resp.status().is_success() => HealthStatus::Healthy,
            Ok(resp) => HealthStatus::Degraded(format!("HTTP {}", resp.status())),
            Err(e) => HealthStatus::Unhealthy(e.to_string()),
        }
    }
}
