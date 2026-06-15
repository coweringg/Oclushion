use std::path::Path;

pub struct Allowlist {
    entries: Vec<String>,
}

impl Allowlist {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    pub fn add(&mut self, path: &str) {
        let normalized = path.replace('\\', "/");
        if !self.entries.contains(&normalized) {
            self.entries.push(normalized);
        }
    }

    pub fn remove(&mut self, path: &str) {
        let normalized = path.replace('\\', "/");
        self.entries.retain(|e| e != &normalized);
    }

    pub fn contains(&self, path: &str) -> bool {
        let normalized = path.replace('\\', "/");
        self.entries.contains(&normalized)
    }

    pub fn is_allowed(&self, path: &str) -> bool {
        let normalized = path.replace('\\', "/");
        let p = Path::new(&normalized);
        for entry in &self.entries {
            let ep = Path::new(entry);
            if p == ep || p.starts_with(ep) {
                return true;
            }
        }
        false
    }

    pub fn entries(&self) -> &[String] {
        &self.entries
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}
