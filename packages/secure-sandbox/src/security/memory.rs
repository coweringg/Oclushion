pub struct MemoryGuard {
    max_mb: u32,
}

impl MemoryGuard {
    pub fn new(max_mb: u32) -> Self {
        MemoryGuard { max_mb }
    }

    pub fn set_max_memory(&mut self, mb: u32) {
        self.max_mb = mb;
    }

    pub fn get_max_memory(&self) -> u32 {
        self.max_mb
    }
}

impl Default for MemoryGuard {
    fn default() -> Self {
        MemoryGuard::new(128)
    }
}
