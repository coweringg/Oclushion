pub struct QuantizationSelector;

impl QuantizationSelector {
    pub fn new() -> Self {
        Self
    }

    pub fn select_quantization(&self, vram_gb: f64) -> String {
        if vram_gb >= 8.0 {
            "Q8_0".to_string()
        } else if vram_gb >= 6.0 {
            "Q6_K".to_string()
        } else if vram_gb >= 4.0 {
            "Q4_K_M".to_string()
        } else {
            "Q4_K_S".to_string()
        }
    }

    pub fn all_quantizations() -> Vec<&'static str> {
        vec!["Q8_0", "Q6_K", "Q5_K_M", "Q5_0", "Q4_K_M", "Q4_K_S", "Q3_K_M", "Q2_K"]
    }
}
