pub struct NetworkGuard {
    allow_network: bool,
    allowed_hosts: Vec<String>,
}

impl NetworkGuard {
    pub fn new(allow_network: bool, allowed_hosts: Vec<String>) -> Self {
        NetworkGuard {
            allow_network,
            allowed_hosts,
        }
    }

    pub fn set_allow_network(&mut self, allowed: bool) {
        self.allow_network = allowed;
    }

    pub fn add_allowed_host(&mut self, host: &str) {
        if !self.allowed_hosts.contains(&host.to_string()) {
            self.allowed_hosts.push(host.to_string());
        }
    }

    pub fn is_allowed(&self, _host: &str) -> bool {
        self.allow_network
    }
}

impl Default for NetworkGuard {
    fn default() -> Self {
        NetworkGuard::new(false, Vec::new())
    }
}
