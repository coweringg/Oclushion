use crate::protocol::messages;
use crate::protocol::tools::ToolRegistry;
use crate::protocol::resources::ResourceRegistry;
use crate::protocol::prompts::PromptRegistry;
use crate::security::permissions::PermissionManager;
use crate::security::approval_ui::ApprovalManager;
use crate::security::credentials::CredentialManager;
use crate::server_manager::registry::ServerRegistry;
use crate::server_manager::lifecycle::ServerLifecycle;
use crate::server_manager::health::HealthMonitor;
use crate::{
    McpError, McpServerConfig, PromptDefinition, ResourceContent, ResourceDefinition,
    Result, ServerCapabilities, ServerStatus, ToolCallRequest, ToolCallResult,
    ToolContent, ToolDefinition,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct McpClient {
    pub registry: Arc<ServerRegistry>,
    pub lifecycle: Arc<ServerLifecycle>,
    pub health: Arc<HealthMonitor>,
    pub permissions: Arc<PermissionManager>,
    pub approvals: Arc<ApprovalManager>,
    pub credentials: Arc<CredentialManager>,
    pub tool_registry: Arc<RwLock<ToolRegistry>>,
    pub resource_registry: Arc<RwLock<ResourceRegistry>>,
    pub prompt_registry: Arc<RwLock<PromptRegistry>>,
}

impl McpClient {
    pub fn new() -> Self {
        let tool_registry = Arc::new(RwLock::new(ToolRegistry::new()));
        let resource_registry = Arc::new(RwLock::new(ResourceRegistry::new()));
        let prompt_registry = Arc::new(RwLock::new(PromptRegistry::new()));
        let registry = Arc::new(ServerRegistry::new());

        let lifecycle = Arc::new(ServerLifecycle::new(
            registry.clone(),
            tool_registry.clone(),
            resource_registry.clone(),
            prompt_registry.clone(),
        ));

        let health = Arc::new(HealthMonitor::new(30));

        McpClient {
            registry,
            lifecycle,
            health,
            permissions: Arc::new(PermissionManager::new()),
            approvals: Arc::new(ApprovalManager::new()),
            credentials: Arc::new(CredentialManager::new()),
            tool_registry,
            resource_registry,
            prompt_registry,
        }
    }

    pub async fn register_server(&self, config: McpServerConfig) -> Result<()> {
        self.registry.register(config).await
    }

    pub async fn unregister_server(&self, name: &str) -> Result<()> {
        if self.lifecycle.is_running(name).await {
            self.lifecycle.stop_server(name).await?;
        }
        self.registry.unregister(name).await
    }

    pub async fn list_servers(&self) -> Vec<ServerStatus> {
        let configs = self.registry.list_all().await;
        let mut statuses = Vec::new();
        for config in configs {
            let is_running = self.lifecycle.is_running(&config.name).await;
            let capabilities = if is_running {
                self.lifecycle.capabilities(&config.name).await
            } else {
                None
            };
            statuses.push(ServerStatus {
                name: config.name,
                is_running,
                pid: None,
                uptime_secs: 0,
                capabilities,
                last_ping_ms: 0,
            });
        }
        statuses
    }

    pub async fn connect(&self, server_name: &str) -> Result<()> {
        let config = self
            .registry
            .get(server_name)
            .await
            .ok_or_else(|| McpError::ServerNotFound(format!("Server '{}' not found", server_name)))?;

        self.lifecycle
            .start_server(server_name, config.transport_type)
            .await
    }

    pub async fn disconnect(&self, server_name: &str) -> Result<()> {
        self.lifecycle.stop_server(server_name).await
    }

    pub async fn get_capabilities(&self, server_name: &str) -> Result<ServerCapabilities> {
        self.lifecycle
            .capabilities(server_name)
            .await
            .ok_or_else(|| McpError::ServerNotFound(format!("Server '{}' not found or not running", server_name)))
    }

    pub async fn call_tool(
        &self,
        server_name: &str,
        request: ToolCallRequest,
    ) -> Result<ToolCallResult> {
        self.permissions
            .can_execute(server_name, &request.tool_name)
            .await?;

        {
            let tool_reg = self.tool_registry.read().await;
            tool_reg.validate_tool_call(&request.tool_name, &request.arguments)?;
        }

        let level = self.permissions.get_permission(server_name, &request.tool_name).await;
        if level == crate::AccessLevel::Destructive {
            let approved = self
                .approvals
                .request_approval(server_name, &request.tool_name, &request.arguments)
                .await?;
            if !approved {
                return Err(McpError::PermissionDenied(format!(
                    "Tool '{}' on server '{}' requires approval",
                    request.tool_name, server_name
                )));
            }
        }

        let req = messages::create_request(
            1,
            messages::METHOD_CALL_TOOL,
            Some(serde_json::json!({
                "name": request.tool_name,
                "arguments": request.arguments
            })),
        );

        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let result_val = response
            .get("result")
            .ok_or_else(|| McpError::ProtocolError("No result in tool call response".to_string()))?;

        let content = result_val
            .get("content")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|c| {
                        let ctype = c.get("type").and_then(|v| v.as_str()).unwrap_or("text");
                        match ctype {
                            "image" => ToolContent::Image {
                                data: c["data"].as_str().unwrap_or("").to_string(),
                                mime_type: c["mimeType"]
                                    .as_str()
                                    .unwrap_or("image/png")
                                    .to_string(),
                            },
                            "resource" => ToolContent::Resource(ResourceContent {
                                uri: c["resource"]["uri"]
                                    .as_str()
                                    .unwrap_or("")
                                    .to_string(),
                                text: c["resource"].get("text").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                blob: c["resource"].get("blob").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                mime_type: c["resource"]["mimeType"]
                                    .as_str()
                                    .unwrap_or("text/plain")
                                    .to_string(),
                            }),
                            _ => ToolContent::Text(
                                c.get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                            ),
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        let is_error = result_val
            .get("is_error")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(ToolCallResult { content, is_error })
    }

    pub async fn read_resource(&self, server_name: &str, uri: &str) -> Result<ResourceContent> {
        let req = messages::create_request(
            1,
            messages::METHOD_READ_RESOURCE,
            Some(serde_json::json!({ "uri": uri })),
        );

        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let result_val = response
            .get("result")
            .ok_or_else(|| McpError::ProtocolError("No result in read resource response".to_string()))?;

        let contents = result_val
            .get("contents")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .ok_or_else(|| McpError::ResourceNotFound(format!("Resource '{}' not found", uri)))?;

        Ok(ResourceContent {
            uri: contents["uri"].as_str().unwrap_or(uri).to_string(),
            text: contents.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()),
            blob: contents.get("blob").and_then(|v| v.as_str()).map(|s| s.to_string()),
            mime_type: contents["mimeType"]
                .as_str()
                .unwrap_or("text/plain")
                .to_string(),
        })
    }

    pub async fn get_prompt(
        &self,
        server_name: &str,
        name: &str,
        args: HashMap<String, String>,
    ) -> Result<String> {
        let req = messages::create_request(
            1,
            messages::METHOD_GET_PROMPT,
            Some(serde_json::json!({
                "name": name,
                "arguments": args
            })),
        );

        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let result_val = response
            .get("result")
            .ok_or_else(|| McpError::ProtocolError("No result in get prompt response".to_string()))?;

        let messages_arr = result_val
            .get("messages")
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No messages in prompt response".to_string()))?;

        let mut output = String::new();
        for msg in messages_arr {
            if let Some(content) = msg.get("content") {
                let text = content
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                output.push_str(text);
                output.push('\n');
            }
        }

        Ok(output)
    }

    pub async fn list_tools(&self, server_name: &str) -> Result<Vec<ToolDefinition>> {
        let req = messages::create_request(1, messages::METHOD_LIST_TOOLS, None);
        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let tools = response
            .get("result")
            .and_then(|r| r.get("tools"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No tools in response".to_string()))?;

        tools
            .iter()
            .map(|t| {
                Ok(ToolDefinition {
                    name: t["name"]
                        .as_str()
                        .ok_or_else(|| McpError::ProtocolError("Tool missing name".to_string()))?
                        .to_string(),
                    description: t["description"].as_str().unwrap_or("").to_string(),
                    input_schema: t.get("input_schema").cloned().unwrap_or(serde_json::Value::Null),
                })
            })
            .collect()
    }

    pub async fn list_resources(&self, server_name: &str) -> Result<Vec<ResourceDefinition>> {
        let req = messages::create_request(1, messages::METHOD_LIST_RESOURCES, None);
        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let resources = response
            .get("result")
            .and_then(|r| r.get("resources"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No resources in response".to_string()))?;

        resources
            .iter()
            .map(|r| {
                Ok(ResourceDefinition {
                    uri: r["uri"]
                        .as_str()
                        .ok_or_else(|| McpError::ProtocolError("Resource missing uri".to_string()))?
                        .to_string(),
                    name: r["name"]
                        .as_str()
                        .ok_or_else(|| McpError::ProtocolError("Resource missing name".to_string()))?
                        .to_string(),
                    description: r["description"].as_str().unwrap_or("").to_string(),
                    mime_type: r.get("mimeType").and_then(|v| v.as_str()).map(|s| s.to_string()),
                })
            })
            .collect()
    }

    pub async fn list_prompts(&self, server_name: &str) -> Result<Vec<PromptDefinition>> {
        let req = messages::create_request(1, messages::METHOD_LIST_PROMPTS, None);
        let response = self
            .lifecycle
            .send_message(server_name, serde_json::to_value(&req)?)
            .await?;

        let prompts = response
            .get("result")
            .and_then(|r| r.get("prompts"))
            .and_then(|v| v.as_array())
            .ok_or_else(|| McpError::ProtocolError("No prompts in response".to_string()))?;

        prompts
            .iter()
            .map(|p| {
                let args = p
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

                Ok(PromptDefinition {
                    name: p["name"]
                        .as_str()
                        .ok_or_else(|| McpError::ProtocolError("Prompt missing name".to_string()))?
                        .to_string(),
                    description: p["description"].as_str().unwrap_or("").to_string(),
                    arguments: args,
                })
            })
            .collect()
    }

    pub async fn shutdown(&self, server_name: &str) -> Result<()> {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1u64,
            "method": "shutdown",
            "params": {}
        });
        let _ = self.lifecycle.send_message(server_name, msg).await;
        self.lifecycle.stop_server(server_name).await
    }
}
