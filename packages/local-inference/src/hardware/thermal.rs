pub struct ThermalMonitor;

impl ThermalMonitor {
    pub fn new() -> Self {
        Self
    }

    pub fn is_throttling(&self) -> bool {
        false
    }

    pub fn get_temperature(&self) -> Option<f64> {
        None
    }
}
