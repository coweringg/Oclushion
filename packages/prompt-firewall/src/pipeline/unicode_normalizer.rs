use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedText {
    pub original: String,
    pub normalized: String,
    pub replacements: HashMap<usize, (char, char)>,
    pub homoglyph_count: usize,
    pub total_normalizations: usize,
}

const HOMOGLYPH_MAP: &[(char, char)] = &[
    ('А', 'A'), ('В', 'B'), ('Е', 'E'), ('К', 'K'), ('М', 'M'),
    ('Н', 'H'), ('О', 'O'), ('Р', 'P'), ('С', 'C'), ('Т', 'T'),
    ('У', 'Y'), ('Х', 'X'), ('а', 'a'), ('е', 'e'), ('о', 'o'),
    ('р', 'p'), ('с', 'c'), ('у', 'y'), ('х', 'x'), ('і', 'i'),
    ('І', 'I'), ('′', '\''), ('ʼ', '\''), ('ˈ', '\''),
    ('α', 'a'), ('β', 'B'), ('ο', 'o'),
    ('Α', 'A'), ('Β', 'B'), ('Ε', 'E'), ('Ο', 'O'),
];

#[derive(Default, Clone)]
pub struct UnicodeNormalizer;

impl UnicodeNormalizer {
    pub fn new() -> Self {
        Self
    }

    pub fn normalize(&self, text: &str) -> NormalizedText {
        let mut replacements: HashMap<usize, (char, char)> = HashMap::new();
        let mut homoglyph_count = 0;
        let mut total_normalizations = 0;

        let normalized: String = text
            .chars()
            .enumerate()
            .map(|(i, c)| {
                let mut out = c;
                for &(homo, latin) in HOMOGLYPH_MAP {
                    if c == homo {
                        replacements.insert(i, (c, latin));
                        out = latin;
                        homoglyph_count += 1;
                        total_normalizations += 1;
                        break;
                    }
                }
                out
            })
            .collect();

        NormalizedText {
            original: text.to_string(),
            normalized,
            replacements,
            homoglyph_count,
            total_normalizations,
        }
    }

    pub fn detect_homoglyphs(&self, text: &str) -> Vec<(usize, char, char)> {
        let mut results = Vec::new();
        for (i, c) in text.chars().enumerate() {
            for &(homo, latin) in HOMOGLYPH_MAP {
                if c == homo {
                    results.push((i, c, latin));
                    break;
                }
            }
        }
        results
    }
}
