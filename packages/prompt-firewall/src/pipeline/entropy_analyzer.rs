use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyResult {
    pub original: String,
    pub entropy: f64,
    pub is_suspicious: bool,
    pub decoded_texts: Vec<String>,
    pub re_scan_results: Vec<String>,
}

#[derive(Default)]
#[derive(Clone)]
pub struct EntropyAnalyzer {
    threshold: f64,
}

impl EntropyAnalyzer {
    pub fn new() -> Self {
        Self { threshold: 4.5 }
    }

    pub fn with_threshold(threshold: f64) -> Self {
        Self { threshold }
    }

    pub fn shannon_entropy(&self, data: &[u8]) -> f64 {
        if data.is_empty() {
            return 0.0;
        }
        let mut freq: HashMap<u8, usize> = HashMap::new();
        let len = data.len() as f64;
        for &b in data {
            *freq.entry(b).or_insert(0) += 1;
        }
        let mut entropy = 0.0;
        for &count in freq.values() {
            let p = count as f64 / len;
            if p > 0.0 {
                entropy -= p * p.log2();
            }
        }
        entropy
    }

    pub fn text_entropy(&self, text: &str) -> f64 {
        self.shannon_entropy(text.as_bytes())
    }

    pub fn analyze(&self, text: &str) -> EntropyResult {
        let entropy = self.text_entropy(text);
        let is_suspicious = entropy > self.threshold && text.len() > 20;
        let mut decoded_texts = Vec::new();
        let mut re_scan_results = Vec::new();

        if text.len() > 20 {
            if entropy > 4.0 {
                if let Ok(decoded) = self.try_base64_decode(text) {
                    decoded_texts.push(decoded.clone());
                    let decoded_entropy = self.text_entropy(&decoded);
                    re_scan_results.push(format!(
                        "base64 decoded (entropy: {:.2}): {}",
                        decoded_entropy,
                        &decoded[..decoded.len().min(100)]
                    ));
                }
            }

            if text.chars().all(|c| c.is_ascii_hexdigit() || c.is_ascii_whitespace()) {
                let cleaned: String = text.chars().filter(|c| c.is_ascii_hexdigit()).collect();
                if cleaned.len() % 2 == 0 && cleaned.len() >= 20 {
                    if let Ok(decoded) = self.try_hex_decode(&cleaned) {
                        decoded_texts.push(decoded.clone());
                        let decoded_entropy = self.text_entropy(&decoded);
                        re_scan_results.push(format!(
                            "hex decoded (entropy: {:.2}): {}",
                            decoded_entropy,
                            &decoded[..decoded.len().min(100)]
                        ));
                    }
                }
            }
        }

        EntropyResult {
            original: text[..text.len().min(200)].to_string(),
            entropy,
            is_suspicious,
            decoded_texts,
            re_scan_results,
        }
    }

    pub fn analyze_strings(&self, strings: &[&str]) -> Vec<EntropyResult> {
        strings.iter().filter(|s| s.len() > 10).map(|s| self.analyze(s)).collect()
    }

    fn try_base64_decode(&self, text: &str) -> Result<String, ()> {
        let cleaned: String = text.chars().filter(|c| !c.is_whitespace()).collect();
        if cleaned.len() < 10 {
            return Err(());
        }
        use base64::Engine;
        let engine = base64::engine::general_purpose::STANDARD;
        if let Ok(bytes) = engine.decode(&cleaned) {
            if let Ok(s) = String::from_utf8(bytes) {
                if s.chars().any(|c| c.is_alphanumeric()) {
                    return Ok(s);
                }
            }
        }
        Err(())
    }

    fn try_hex_decode(&self, text: &str) -> Result<String, ()> {
        let cleaned: String = text.chars().filter(|c| c.is_ascii_hexdigit()).collect();
        if cleaned.len() % 2 != 0 || cleaned.len() < 10 {
            return Err(());
        }
        let bytes: Vec<u8> = cleaned
            .as_bytes()
            .chunks(2)
            .filter_map(|chunk| {
                let s = std::str::from_utf8(chunk).ok()?;
                u8::from_str_radix(s, 16).ok()
            })
            .collect();
        if bytes.len() < 5 {
            return Err(());
        }
        if let Ok(s) = String::from_utf8(bytes) {
            if s.chars().any(|c| c.is_alphanumeric()) {
                return Ok(s);
            }
        }
        Err(())
    }
}
