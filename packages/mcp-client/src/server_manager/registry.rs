use crate::{McpError, McpServerConfig, Result, ToolDefinition};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Default)]
pub struct ServerRegistry {
    servers: Arc<RwLock<HashMap<String, McpServerConfig>>>,
}

impl ServerRegistry {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn with_arc(servers: Arc<RwLock<HashMap<String, McpServerConfig>>>) -> Self {
        Self { servers }
    }

    pub async fn register(&self, config: McpServerConfig) -> Result<()> {
        let mut guard = self.servers.write().await;
        let name = config.name.clone();
        if guard.contains_key(&name) {
            return Err(McpError::ProtocolError(format!(
                "Server '{}' is already registered",
                name
            )));
        }
        guard.insert(name, config);
        Ok(())
    }

    pub async fn unregister(&self, name: &str) -> Result<()> {
        let mut guard = self.servers.write().await;
        guard.remove(name).ok_or_else(|| {
            McpError::ServerNotFound(format!("Server '{}' not found in registry", name))
        })?;
        Ok(())
    }

    pub async fn get(&self, name: &str) -> Option<McpServerConfig> {
        let guard = self.servers.read().await;
        guard.get(name).cloned()
    }

    pub async fn list_all(&self) -> Vec<McpServerConfig> {
        let guard = self.servers.read().await;
        guard.values().cloned().collect()
    }

    pub async fn find_by_tool(&self, _tool_name: &str) -> Option<(String, ToolDefinition)> {
        None
    }

    pub fn arc(&self) -> Arc<RwLock<HashMap<String, McpServerConfig>>> {
        self.servers.clone()
    }

    pub async fn save(&self, path: &Path) -> Result<()> {
        let guard = self.servers.read().await;
        let json = serde_json::to_string_pretty(&*guard)?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }

    pub async fn load(path: &Path) -> Result<Self> {
        let data = tokio::fs::read_to_string(path).await?;
        let servers: HashMap<String, McpServerConfig> = serde_json::from_str(&data)?;
        Ok(Self {
            servers: Arc::new(RwLock::new(servers)),
        })
    }
}
