pub struct RamMonitor;

impl RamMonitor {
    pub fn new() -> Self {
        Self
    }

    pub fn available_ram_gb(&self) -> f64 {
        sys_info::mem_info()
            .map(|m| m.avail as f64 / (1024.0 * 1024.0 * 1024.0))
            .unwrap_or(0.0)
    }

    pub fn total_ram_gb(&self) -> f64 {
        sys_info::mem_info()
            .map(|m| m.total as f64 / (1024.0 * 1024.0 * 1024.0))
            .unwrap_or(0.0)
    }

    pub fn is_low_memory(&self) -> bool {
        self.available_ram_gb() < 2.0
    }
}
