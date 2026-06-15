use crate::transport::{create_transport, Transport};
use crate::{McpError, Result, ServerCapabilities, TransportType};
use crate::protocol::messages;
use crate::protocol::tools::ToolRegistry;
use crate::protocol::resources::ResourceRegistry;
use crate::protocol::prompts::PromptRegistry;
use crate::server_manager::registry::ServerRegistry;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

type RunningTransport = (Transport, ServerCapabilities);

pub struct ServerLifecycle {
    registry: Arc<ServerRegistry>,
    running: Arc<RwLock<HashMap<String, RunningTransport>>>,
    tool_registry: Arc<RwLock<ToolRegistry>>,
    resource_registry: Arc<RwLock<ResourceRegistry>>,
    prompt_registry: Arc<RwLock<PromptRegistry>>,
}

impl ServerLifecycle {
    pub fn new(
        registry: Arc<ServerRegistry>,
        tool_registry: Arc<RwLock<ToolRegistry>>,
        resource_registry: Arc<RwLock<ResourceRegistry>>,
        prompt_registry: Arc<RwLock<PromptRegistry>>,
    ) -> Self {
        Self {
            registry,
            running: Arc::new(RwLock::new(HashMap::new())),
            tool_registry,
            resource_registry,
            prompt_registry,
        }
    }

    pub async fn start_server(
        &self,
        name: &str,
        transport_type: TransportType,
    ) -> Result<()> {
        let config = self
            .registry
            .get(name)
            .await
            .ok_or_else(|| McpError::ServerNotFound(format!("Server '{}' not found", name)))?;

        let env = config.env_vars.clone();
        let transport = create_transport(
            &transport_type,
            config.command.as_deref(),
            &config.args,
            config.url.as_deref(),
            env,
        );

        transport.start().await?;

        let caps = self.perform_initialize(&transport).await?;

        {
            let mut tool_reg = self.tool_registry.write().await;
            tool_reg.register_server_tools(name, caps.tools.clone());
        }
        {
            let mut res_reg = self.resource_registry.write().await;
            res_reg.register_server_resources(name, caps.resources.clone());
        }
        {
            let mut prompt_reg = self.prompt_registry.write().await;
            prompt_reg.register_server_prompts(name, caps.prompts.clone());
        }

        let mut running = self.running.write().await;
        running.insert(name.to_string(), (transport, caps));

        Ok(())
    }

    pub async fn stop_server(&self, name: &str) -> Result<()> {
        {
            let mut running = self.running.write().await;
            if let Some((transport, _)) = running.remove(name) {
                let _ = transport.stop().await;
            }
        }
        {
            let mut tool_reg = self.tool_registry.write().await;
            tool_reg.remove_server_tools(name);
        }
        {
            let mut res_reg = self.resource_registry.write().await;
            res_reg.remove_server_resources(name);
        }
        {
            let mut prompt_reg = self.prompt_registry.write().await;
            prompt_reg.remove_server_prompts(name);
        }
        Ok(())
    }

    pub async fn restart_server(&self, name: &str) -> Result<()> {
        let config = self
            .registry
            .get(name)
            .await
            .ok_or_else(|| McpError::ServerNotFound(format!("Server '{}' not found", name)))?;

        self.stop_server(name).await?;
        self.start_server(name, config.transport_type).await
    }

    pub async fn start_all(&self) -> Result<()> {
        let configs = self.registry.list_all().await;
        for config in configs {
            if config.auto_start {
                if let Err(e) = self.start_server(&config.name, config.transport_type).await {
                    eprintln!("Failed to start server '{}': {}", config.name, e);
                }
            }
        }
        Ok(())
    }

    pub async fn stop_all(&self) -> Result<()> {
        let mut running = self.running.write().await;
        for (name, (transport, _)) in running.drain() {
            let _ = transport.stop().await;
            {
                let mut tool_reg = self.tool_registry.write().await;
                tool_reg.remove_server_tools(&name);
            }
            {
                let mut res_reg = self.resource_registry.write().await;
                res_reg.remove_server_resources(&name);
            }
            {
                let mut prompt_reg = self.prompt_registry.write().await;
                prompt_reg.remove_server_prompts(&name);
            }
        }
        Ok(())
    }

    pub async fn is_running(&self, name: &str) -> bool {
        let running = self.running.read().await;
        running.contains_key(name)
    }

    pub async fn send_message(&self, name: &str, message: serde_json::Value) -> Result<serde_json::Value> {
        let running = self.running.read().await;
        let (transport, _) = running.get(name).ok_or_else(|| {
            McpError::ServerNotFound(format!("Server '{}' not running", name))
        })?;
        transport.send(message).await
    }

    pub async fn capabilities(&self, name: &str) -> Option<ServerCapabilities> {
        let running = self.running.read().await;
        running.get(name).map(|(_, caps)| caps.clone())
    }

    pub async fn running_servers(&self) -> Vec<String> {
        let running = self.running.read().await;
        running.keys().cloned().collect()
    }

    pub fn running_arc(&self) -> Arc<RwLock<HashMap<String, RunningTransport>>> {
        self.running.clone()
    }

    async fn perform_initialize(&self, transport: &Transport) -> Result<ServerCapabilities> {
        let req = messages::create_request(
            1,
            messages::METHOD_INITIALIZE,
            Some(serde_json::json!({
                "protocol_version": "2024-11-05",
                "capabilities": {
                    "tools": {},
                    "resources": {},
                    "prompts": {}
                },
                "client_info": {
                    "name": "oclushion-mcp-client",
                    "version": "0.1.0"
                }
            })),
        );

        let response = transport.send(serde_json::to_value(&req)?).await?;

        let _caps = response
            .get("result")
            .and_then(|r| r.get("capabilities"))
            .ok_or_else(|| McpError::HandshakeFailed("No capabilities in init response".to_string()))?;

        let tools = Self::fetch_tools(transport).await?;
        let resources = Self::fetch_resources(transport).await?;
        let prompts = Self::fetch_prompts(transport).await?;

        Ok(ServerCapabilities {
            tools,
            resources,
            prompts,
        })
    }

    async fn fetch_tools(transport: &Transport) -> Result<Vec<crate::ToolDefinition>> {
        let req = messages::create_request(2, messages::METHOD_LIST_TOOLS, None);
        let response = transport.send(serde_json::to_value(&req)?).await?;

        let tool_list = response
            .get("result")
            .and_then(|r| r.get("tools"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No tools in response".to_string()))?;

        let mut tools = Vec::new();
        for tool_val in tool_list {
            let name = tool_val["name"].as_str().unwrap_or("").to_string();
            let description = tool_val["description"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let input_schema = tool_val.get("input_schema").cloned().unwrap_or(serde_json::Value::Null);
            tools.push(crate::ToolDefinition {
                name,
                description,
                input_schema,
            });
        }
        Ok(tools)
    }

    async fn fetch_resources(transport: &Transport) -> Result<Vec<crate::ResourceDefinition>> {
        let req = messages::create_request(3, messages::METHOD_LIST_RESOURCES, None);
        let response = transport.send(serde_json::to_value(&req)?).await?;

        let resource_list = response
            .get("result")
            .and_then(|r| r.get("resources"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No resources in response".to_string()))?;

        let mut resources = Vec::new();
        for res_val in resource_list {
            let uri = res_val["uri"].as_str().unwrap_or("").to_string();
            let name = res_val["name"].as_str().unwrap_or("").to_string();
            let description = res_val["description"].as_str().unwrap_or("").to_string();
            let mime_type = res_val.get("mimeType").and_then(|v| v.as_str()).map(|s| s.to_string());
            resources.push(crate::ResourceDefinition {
                uri,
                name,
                description,
                mime_type,
            });
        }
        Ok(resources)
    }

    async fn fetch_prompts(transport: &Transport) -> Result<Vec<crate::PromptDefinition>> {
        let req = messages::create_request(4, messages::METHOD_LIST_PROMPTS, None);
        let response = transport.send(serde_json::to_value(&req)?).await?;

        let prompt_list = response
            .get("result")
            .and_then(|r| r.get("prompts"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No prompts in response".to_string()))?;

        let mut prompts = Vec::new();
        for p_val in prompt_list {
            let name = p_val["name"].as_str().unwrap_or("").to_string();
            let description = p_val["description"].as_str().unwrap_or("").to_string();
            let args = p_val
                .get("arguments")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .map(|a| crate::PromptArg {
                            name: a["name"].as_str().unwrap_or("").to_string(),
                            description: a["description"].as_str().unwrap_or("").to_string(),
                            required: a["required"].as_bool().unwrap_or(false),
                        })
                        .collect()
                })
                .unwrap_or_default();
            prompts.push(crate::PromptDefinition {
                name,
                description,
                arguments: args,
            });
        }
        Ok(prompts)
    }
}
