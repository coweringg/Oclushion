use crate::PromptDefinition;
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct PromptRegistry {
    prompts: HashMap<String, Vec<PromptDefinition>>,
}

impl PromptRegistry {
    pub fn new() -> Self {
        Self {
            prompts: HashMap::new(),
        }
    }

    pub fn register(&mut self, server: &str, prompt: PromptDefinition) {
        self.prompts
            .entry(server.to_string())
            .or_default()
            .push(prompt);
    }

    pub fn register_server_prompts(&mut self, server: &str, prompts: Vec<PromptDefinition>) {
        self.prompts.insert(server.to_string(), prompts);
    }

    pub fn get(&self, name: &str) -> Option<(String, PromptDefinition)> {
        for (server, prompts) in &self.prompts {
            for prompt in prompts {
                if prompt.name == name {
                    return Some((server.clone(), prompt.clone()));
                }
            }
        }
        None
    }

    pub fn list_all(&self) -> Vec<(String, PromptDefinition)> {
        let mut result = Vec::new();
        for (server, prompts) in &self.prompts {
            for prompt in prompts {
                result.push((server.clone(), prompt.clone()));
            }
        }
        result
    }

    pub fn list_for_server(&self, server: &str) -> Vec<PromptDefinition> {
        self.prompts.get(server).cloned().unwrap_or_default()
    }

    pub fn remove_server_prompts(&mut self, server: &str) {
        self.prompts.remove(server);
    }
}
