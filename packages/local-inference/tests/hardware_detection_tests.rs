use local_inference::hardware::gpu_detect::GpuDetector;
use local_inference::hardware::ram_monitor::RamMonitor;
use local_inference::hardware::thermal::ThermalMonitor;
use local_inference::hardware::backend_selector::BackendSelector;
use local_inference::BackendKind;

#[test]
fn test_gpu_detection_does_not_crash() {
    let detector = GpuDetector::new();
    let info = detector.detect_gpu();
    assert!(info.is_ok());
    let info = info.unwrap();
    assert_eq!(info.backend, BackendKind::Cpu);
    assert!(info.total_ram_gb > 0.0);
    assert!(info.cpu_cores > 0);
}

#[test]
fn test_ram_monitor_returns_positive_values() {
    let monitor = RamMonitor::new();
    let available = monitor.available_ram_gb();
    let total = monitor.total_ram_gb();
    assert!(available >= 0.0);
    assert!(total > 0.0);
}

#[test]
fn test_ram_monitor_low_memory_check() {
    let monitor = RamMonitor::new();
    let is_low = monitor.is_low_memory();
    assert!(is_low == (monitor.available_ram_gb() < 2.0));
}

#[test]
fn test_thermal_monitor_no_throttling() {
    let monitor = ThermalMonitor::new();
    assert!(!monitor.is_throttling());
}

#[test]
fn test_thermal_monitor_temp_is_none() {
    let monitor = ThermalMonitor::new();
    assert!(monitor.get_temperature().is_none());
}

#[test]
fn test_backend_selector_returns_cpu_as_is() {
    let selector = BackendSelector::new();
    let hw = local_inference::HardwareInfo {
        backend: BackendKind::Cpu,
        total_ram_gb: 16.0,
        available_ram_gb: 8.0,
        cpu_cores: 8,
        cpu_threads: 16,
    };
    let backend = selector.select_backend(&hw);
    assert!(backend.is_ok());
    assert_eq!(backend.unwrap(), BackendKind::Cpu);
}

#[test]
fn test_backend_selector_quantization() {
    let selector = BackendSelector::new();
    let hw = local_inference::HardwareInfo {
        backend: BackendKind::Cpu,
        total_ram_gb: 16.0,
        available_ram_gb: 8.0,
        cpu_cores: 8,
        cpu_threads: 16,
    };
    let quant = selector.select_quantization(&hw);
    assert!(quant.is_ok());
}

#[test]
fn test_gpu_detector_returns_hardware_info() {
    let detector = GpuDetector::new();
    let info = detector.detect_gpu().unwrap();
    assert_eq!(info.backend, BackendKind::Cpu);
    assert!(info.cpu_threads >= info.cpu_cores);
}
