use std::path::PathBuf;
use std::sync::Arc;

use dashmap::DashMap;
use oxc_allocator::Allocator;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;

#[derive(Clone)]
pub struct CachedSource {
    pub hash: [u8; 32],
    pub source: Arc<String>,
    pub path: PathBuf,
}

impl CachedSource {
    pub fn parse<'a>(&'a self, allocator: &'a Allocator) -> ParserReturn<'a> {
        let source_type = self.infer_source_type();
        Parser::new(allocator, self.source.as_str(), source_type).parse()
    }

    fn infer_source_type(&self) -> SourceType {
        SourceType::from_path(&self.path)
            .unwrap_or_else(|_| SourceType::mjs())
    }
}

pub struct SourceCache {
    store: DashMap<String, CachedSource>,
}

impl SourceCache {
    pub fn new() -> Self {
        Self { store: DashMap::new() }
    }

    pub fn get(&self, path: &str) -> Option<CachedSource> {
        self.store.get(path).map(|v| v.clone())
    }

    pub fn insert(&self, path: String, cached: CachedSource) {
        self.store.insert(path, cached);
    }

    pub fn remove(&self, path: &str) {
        self.store.remove(path);
    }

    pub fn contains(&self, path: &str) -> bool {
        self.store.contains_key(path)
    }

    pub fn len(&self) -> usize {
        self.store.len()
    }

    pub fn is_empty(&self) -> bool {
        self.store.is_empty()
    }
}
