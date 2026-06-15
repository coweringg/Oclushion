use std::collections::HashMap;
use sha2::{Digest, Sha256};
use crate::EmbeddingError;

pub struct EmbeddingCache {
    map: HashMap<u64, Vec<f32>>,
    order: Vec<u64>,
    capacity: usize,
}

impl EmbeddingCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            map: HashMap::new(),
            order: Vec::new(),
            capacity,
        }
    }

    fn hash_key(text: &str) -> u64 {
        let hash = Sha256::digest(text.as_bytes());
        u64::from_le_bytes(hash[..8].try_into().unwrap())
    }

    pub fn get_or_compute(
        &mut self,
        text: &str,
        compute_fn: impl FnOnce(&str) -> Result<Vec<f32>, EmbeddingError>,
    ) -> Result<Vec<f32>, EmbeddingError> {
        let key = Self::hash_key(text);
        if let Some(vec) = self.map.get(&key) {
            return Ok(vec.clone());
        }
        let vec = compute_fn(text)?;
        self.insert(key, vec.clone());
        Ok(vec)
    }

    fn insert(&mut self, key: u64, value: Vec<f32>) {
        if self.map.len() >= self.capacity {
            if let Some(&oldest) = self.order.first() {
                self.map.remove(&oldest);
                self.order.retain(|&k| k != oldest);
            }
        }
        self.map.entry(key).or_insert_with(|| {
            self.order.push(key);
            value
        });
    }

    pub fn contains(&self, text: &str) -> bool {
        let key = Self::hash_key(text);
        self.map.contains_key(&key)
    }

    pub fn clear(&mut self) {
        self.map.clear();
        self.order.clear();
    }
}
