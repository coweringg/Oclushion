use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternEntry {
    pub id: String,
    pub phrase: String,
    pub severity: f64,
    pub category: String,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_id: String,
    pub matched_text: String,
    pub position: usize,
    pub severity: f64,
    pub category: String,
}

#[derive(Clone)]
pub struct PatternMatcher {
    patterns: Vec<(PatternEntry, Regex)>,
}

impl PatternMatcher {
    pub fn new(entries: &[PatternEntry]) -> Result<Self, String> {
        let mut patterns = Vec::new();
        for entry in entries {
            let re = Regex::new(&entry.phrase)
                .map_err(|e| format!("Invalid regex '{}': {}", entry.phrase, e))?;
            patterns.push((entry.clone(), re));
        }
        Ok(Self { patterns })
    }

    pub fn load_from_json(json: &str) -> Result<Self, String> {
        let entries: Vec<PatternEntry> = serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse pattern DB: {}", e))?;
        Self::new(&entries)
    }

    pub fn scan(&self, text: &str) -> Vec<PatternMatch> {
        let mut matches = Vec::new();
        for (entry, re) in &self.patterns {
            for cap in re.find_iter(text) {
                matches.push(PatternMatch {
                    pattern_id: entry.id.clone(),
                    matched_text: cap.as_str().to_string(),
                    position: cap.start(),
                    severity: entry.severity,
                    category: entry.category.clone(),
                });
            }
        }
        matches
    }

    pub fn scan_with_context(&self, text: &str, line_number: usize, _context: &str) -> Vec<PatternMatch> {
        let mut matches = self.scan(text);
        for m in &mut matches {
            m.position = m.position.saturating_add(line_number);
        }
        matches
    }

    pub fn max_severity(&self, matches: &[PatternMatch]) -> f64 {
        matches.iter().map(|m| m.severity).fold(0.0_f64, f64::max)
    }

    pub fn aggregate_score(&self, matches: &[PatternMatch]) -> f64 {
        if matches.is_empty() {
            return 0.0;
        }
        let sum: f64 = matches.iter().map(|m| m.severity).sum();
        let count = matches.len() as f64;
        let avg = sum / count;
        let max = self.max_severity(matches);
        0.6 * max + 0.4 * avg.min(1.0)
    }
}

pub fn build_leet_variations(base: &str) -> Vec<String> {
    let leet_map: HashMap<char, Vec<char>> = [
        ('a', vec!['a', '4', '@']),
        ('e', vec!['e', '3']),
        ('i', vec!['i', '1', '!']),
        ('o', vec!['o', '0']),
        ('s', vec!['s', '5', '$']),
        ('t', vec!['t', '7']),
        ('l', vec!['l', '1']),
        ('g', vec!['g', '9']),
        ('b', vec!['b', '8']),
    ]
    .iter()
    .cloned()
    .collect();

    let lower = base.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    let mut results = Vec::new();

    fn gen(chars: &[char], idx: usize, current: String, map: &HashMap<char, Vec<char>>, results: &mut Vec<String>) {
        if idx == chars.len() {
            results.push(current);
            return;
        }
        let c = chars[idx];
        if let Some(variants) = map.get(&c) {
            for &v in variants {
                let mut next = current.clone();
                next.push(v);
                gen(chars, idx + 1, next, map, results);
            }
        } else {
            let mut next = current;
            next.push(c);
            gen(chars, idx + 1, next, map, results);
        }
    }

    gen(&chars, 0, String::new(), &leet_map, &mut results);
    results
}

pub fn build_variation_pattern(phrases: &[&str]) -> String {
    let escaped: Vec<String> = phrases.iter().map(|p| regex::escape(p)).collect();
    if escaped.is_empty() {
        return "(?!)".to_string();
    }
    escaped.join("|")
}

pub fn build_fuzzy_pattern(base: &str, max_edits: usize) -> String {
    let mut parts = Vec::new();
    for ch in base.chars() {
        if ch.is_alphanumeric() {
            parts.push(format!(r"(?:{}{{0,{}}})", regex::escape(&ch.to_string()), max_edits));
        } else {
            parts.push(regex::escape(&ch.to_string()));
        }
    }
    parts.concat()
}
