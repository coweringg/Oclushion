use serde::{Deserialize, Serialize};
use crate::Severity;

const INVISIBLE_CHARS: &[(char, &str, Severity)] = &[
    ('\u{200B}', "Zero-Width Space", Severity::Medium),
    ('\u{200C}', "Zero-Width Non-Joiner", Severity::Low),
    ('\u{200D}', "Zero-Width Joiner", Severity::Medium),
    ('\u{200E}', "Left-to-Right Mark", Severity::Low),
    ('\u{200F}', "Right-to-Left Mark", Severity::Low),
    ('\u{202A}', "Left-to-Right Embedding", Severity::Low),
    ('\u{202B}', "Right-to-Left Embedding", Severity::Medium),
    ('\u{202C}', "Pop Directional Formatting", Severity::Low),
    ('\u{202D}', "Left-to-Right Override", Severity::Medium),
    ('\u{202E}', "Right-to-Left Override", Severity::High),
    ('\u{2060}', "Word Joiner", Severity::Low),
    ('\u{2061}', "Function Application", Severity::Low),
    ('\u{2062}', "Invisible Times", Severity::Low),
    ('\u{2063}', "Invisible Separator", Severity::Low),
    ('\u{2064}', "Invisible Plus", Severity::Low),
    ('\u{FEFF}', "Byte Order Mark", Severity::Low),
    ('\u{00AD}', "Soft Hyphen", Severity::Low),
    ('\u{034F}', "Combining Grapheme Joiner", Severity::Medium),
    ('\u{061C}', "Arabic Letter Mark", Severity::Low),
    ('\u{180E}', "Mongolian Vowel Separator", Severity::Low),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvisibleCharMatch {
    pub char_name: String,
    pub char_code: u32,
    pub position: usize,
    pub severity: Severity,
}

#[derive(Default, Clone)]
pub struct InvisibleCharDetector;

impl InvisibleCharDetector {
    pub fn new() -> Self {
        Self
    }

    pub fn scan(&self, text: &str) -> Vec<InvisibleCharMatch> {
        let mut matches = Vec::new();
        for (i, c) in text.char_indices() {
            for &(ch, name, ref sev) in INVISIBLE_CHARS {
                if c == ch {
                    matches.push(InvisibleCharMatch {
                        char_name: name.to_string(),
                        char_code: c as u32,
                        position: i,
                        severity: sev.clone(),
                    });
                    break;
                }
            }
        }
        matches
    }

    pub fn severity_score(&self, matches: &[InvisibleCharMatch]) -> f64 {
        if matches.is_empty() {
            return 0.0;
        }
        let mut total = 0.0;
        for m in matches {
            total += match m.severity {
                Severity::Critical => 1.0,
                Severity::High => 0.8,
                Severity::Medium => 0.5,
                Severity::Low => 0.2,
                Severity::None => 0.0,
            };
        }
        (total / matches.len() as f64).min(1.0)
    }
}
