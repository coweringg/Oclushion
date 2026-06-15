use crate::ResourceDefinition;
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct ResourceRegistry {
    resources: HashMap<String, Vec<ResourceDefinition>>,
}

impl ResourceRegistry {
    pub fn new() -> Self {
        Self {
            resources: HashMap::new(),
        }
    }

    pub fn register(&mut self, server: &str, resource: ResourceDefinition) {
        self.resources
            .entry(server.to_string())
            .or_default()
            .push(resource);
    }

    pub fn register_server_resources(&mut self, server: &str, resources: Vec<ResourceDefinition>) {
        self.resources.insert(server.to_string(), resources);
    }

    pub fn get(&self, uri: &str) -> Option<(String, ResourceDefinition)> {
        for (server, resources) in &self.resources {
            for resource in resources {
                if resource.uri == uri {
                    return Some((server.clone(), resource.clone()));
                }
            }
        }
        None
    }

    pub fn list_all(&self) -> Vec<(String, ResourceDefinition)> {
        let mut result = Vec::new();
        for (server, resources) in &self.resources {
            for resource in resources {
                result.push((server.clone(), resource.clone()));
            }
        }
        result
    }

    pub fn list_for_server(&self, server: &str) -> Vec<ResourceDefinition> {
        self.resources.get(server).cloned().unwrap_or_default()
    }

    pub fn remove_server_resources(&mut self, server: &str) {
        self.resources.remove(server);
    }
}
