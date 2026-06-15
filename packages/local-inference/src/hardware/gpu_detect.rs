use crate::{BackendKind, HardwareInfo, HardwareError};

pub struct GpuDetector;

impl GpuDetector {
    pub fn new() -> Self {
        Self
    }

    pub fn detect_gpu(&self) -> Result<HardwareInfo, HardwareError> {
        let available_ram = sys_info::mem_info()
            .map(|m| m.avail as f64 / (1024.0 * 1024.0 * 1024.0))
            .unwrap_or(8.0);

        let total_ram = sys_info::mem_info()
            .map(|m| m.total as f64 / (1024.0 * 1024.0 * 1024.0))
            .unwrap_or(16.0);

        let cpus = sys_info::cpu_num()
            .unwrap_or(4);

        Ok(HardwareInfo {
            backend: BackendKind::Cpu,
            total_ram_gb: total_ram,
            available_ram_gb: available_ram,
            cpu_cores: cpus as u32,
            cpu_threads: (cpus * 2) as u32,
        })
    }
}
