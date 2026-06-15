use std::collections::HashMap;

pub struct Tokenizer {
    vocab: HashMap<String, u32>,
    next_id: u32,
}

impl Tokenizer {
    pub fn new() -> Self {
        Self {
            vocab: HashMap::new(),
            next_id: 1,
        }
    }

    pub fn tokenize(&mut self, text: &str) -> Vec<u32> {
        let mut tokens = Vec::new();
        for word in text.split_whitespace() {
            let cleaned: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
            if cleaned.is_empty() {
                continue;
            }
            let lowered = cleaned.to_lowercase();
            let id = *self.vocab.entry(lowered).or_insert_with(|| {
                let id = self.next_id;
                self.next_id += 1;
                id
            });
            tokens.push(id);
        }
        tokens
    }

    pub fn count_tokens(&self, text: &str) -> usize {
        text.split_whitespace()
            .map(|w| w.chars().filter(|c| c.is_alphanumeric()).collect::<String>())
            .filter(|s| !s.is_empty())
            .count()
    }
}
