use crate::{BackendKind, HardwareInfo, HardwareError};
use crate::models::quantization::QuantizationSelector;

pub struct BackendSelector;

impl BackendSelector {
    pub fn new() -> Self {
        Self
    }

    pub fn select_backend(&self, hardware: &HardwareInfo) -> Result<BackendKind, HardwareError> {
        match hardware.backend {
            BackendKind::Cuda => Ok(BackendKind::Cuda),
            BackendKind::Metal => Ok(BackendKind::Metal),
            BackendKind::Vulkan => Ok(BackendKind::Vulkan),
            BackendKind::Rocm => Ok(BackendKind::Rocm),
            BackendKind::Cpu => Ok(BackendKind::Cpu),
        }
    }

    pub fn select_quantization(&self, hardware: &HardwareInfo) -> Result<String, HardwareError> {
        let selector = QuantizationSelector::new();
        if hardware.backend == BackendKind::Cpu {
            Ok(selector.select_quantization(hardware.total_ram_gb * 0.5))
        } else {
            Ok(selector.select_quantization(hardware.total_ram_gb * 0.75))
        }
    }
}
