use crate::{AccessLevel, McpError, Permission, Result, ToolDefinition};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct PermissionManager {
    permissions: Arc<RwLock<HashMap<String, HashMap<String, AccessLevel>>>>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            permissions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn set_permission(&self, server: &str, tool: &str, level: AccessLevel) {
        let mut guard = self.permissions.write().await;
        guard
            .entry(server.to_string())
            .or_default()
            .insert(tool.to_string(), level);
    }

    pub async fn get_permission(&self, server: &str, tool: &str) -> AccessLevel {
        let guard = self.permissions.read().await;
        guard
            .get(server)
            .and_then(|tools| tools.get(tool))
            .cloned()
            .unwrap_or(AccessLevel::ReadOnly)
    }

    pub async fn can_execute(&self, server: &str, tool: &str) -> Result<()> {
        let level = self.get_permission(server, tool).await;
        match level {
            AccessLevel::ReadOnly | AccessLevel::ReadWrite | AccessLevel::Destructive => Ok(()),
            AccessLevel::Custom(ref msg) => Err(McpError::PermissionDenied(msg.clone())),
        }
    }

    pub fn classify_tool(tool: &ToolDefinition) -> AccessLevel {
        let name = tool.name.to_lowercase();
        if name.starts_with("drop")
            || name.starts_with("delete")
            || name.starts_with("write")
            || name.starts_with("remove")
            || name.starts_with("destroy")
            || name.starts_with("purge")
            || name.starts_with("create")
            || name.starts_with("update")
            || name.starts_with("edit")
        {
            AccessLevel::Destructive
        } else if name.starts_with("read")
            || name.starts_with("get")
            || name.starts_with("list")
            || name.starts_with("fetch")
            || name.starts_with("query")
            || name.starts_with("search")
            || name.starts_with("find")
            || name.starts_with("show")
        {
            AccessLevel::ReadOnly
        } else {
            AccessLevel::ReadWrite
        }
    }

    pub async fn list_permissions(&self) -> Vec<Permission> {
        let guard = self.permissions.read().await;
        let mut result = Vec::new();
        for (server, tools) in guard.iter() {
            for (tool, level) in tools.iter() {
                result.push(Permission {
                    server_name: server.clone(),
                    tool_name: tool.clone(),
                    access: level.clone(),
                });
            }
        }
        result
    }

    pub async fn save(&self, path: &Path) -> Result<()> {
        let guard = self.permissions.read().await;
        let json = serde_json::to_string_pretty(&*guard)?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }

    pub async fn load(path: &Path) -> Result<Self> {
        let data = tokio::fs::read_to_string(path).await?;
        let permissions: HashMap<String, HashMap<String, AccessLevel>> =
            serde_json::from_str(&data)?;
        Ok(Self {
            permissions: Arc::new(RwLock::new(permissions)),
        })
    }
}
