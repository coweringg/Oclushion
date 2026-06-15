use crate::client::McpClient;
use crate::{AccessLevel, McpServerConfig, ToolCallRequest};
use std::sync::OnceLock;
use tokio::sync::Mutex;

fn client() -> &'static Mutex<McpClient> {
    static CLIENT: OnceLock<Mutex<McpClient>> = OnceLock::new();
    CLIENT.get_or_init(|| Mutex::new(McpClient::new()))
}

pub struct TauriCommands;

impl TauriCommands {
    pub async fn mcp_register_server(config_json: String) -> Result<String, String> {
        let cl = client().lock().await;
        let config: McpServerConfig =
            serde_json::from_str(&config_json).map_err(|e| e.to_string())?;
        cl.register_server(config).await.map_err(|e| e.to_string())?;
        Ok("ok".to_string())
    }

    pub async fn mcp_unregister_server(name: String) -> Result<(), String> {
        let cl = client().lock().await;
        cl.unregister_server(&name).await.map_err(|e| e.to_string())
    }

    pub async fn mcp_list_servers() -> Result<String, String> {
        let cl = client().lock().await;
        let servers = cl.list_servers().await;
        serde_json::to_string(&servers).map_err(|e| e.to_string())
    }

    pub async fn mcp_connect(server_name: String) -> Result<(), String> {
        let cl = client().lock().await;
        cl.connect(&server_name).await.map_err(|e| e.to_string())
    }

    pub async fn mcp_disconnect(server_name: String) -> Result<(), String> {
        let cl = client().lock().await;
        cl.disconnect(&server_name).await.map_err(|e| e.to_string())
    }

    pub async fn mcp_get_capabilities(server_name: String) -> Result<String, String> {
        let cl = client().lock().await;
        let caps = cl.get_capabilities(&server_name).await.map_err(|e| e.to_string())?;
        serde_json::to_string(&caps).map_err(|e| e.to_string())
    }

    pub async fn mcp_call_tool(server_name: String, request_json: String) -> Result<String, String> {
        let cl = client().lock().await;
        let request: ToolCallRequest =
            serde_json::from_str(&request_json).map_err(|e| e.to_string())?;
        let result = cl
            .call_tool(&server_name, request)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::to_string(&result).map_err(|e| e.to_string())
    }

    pub async fn mcp_read_resource(server_name: String, uri: String) -> Result<String, String> {
        let cl = client().lock().await;
        let resource = cl
            .read_resource(&server_name, &uri)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::to_string(&resource).map_err(|e| e.to_string())
    }

    pub async fn mcp_get_prompt(
        server_name: String,
        name: String,
        args_json: String,
    ) -> Result<String, String> {
        let cl = client().lock().await;
        let args: std::collections::HashMap<String, String> =
            serde_json::from_str(&args_json).map_err(|e| e.to_string())?;
        let result = cl
            .get_prompt(&server_name, &name, args)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub async fn mcp_list_tools(server_name: String) -> Result<String, String> {
        let cl = client().lock().await;
        let tools = cl.list_tools(&server_name).await.map_err(|e| e.to_string())?;
        serde_json::to_string(&tools).map_err(|e| e.to_string())
    }

    pub async fn mcp_list_resources(server_name: String) -> Result<String, String> {
        let cl = client().lock().await;
        let resources = cl
            .list_resources(&server_name)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::to_string(&resources).map_err(|e| e.to_string())
    }

    pub async fn mcp_list_prompts(server_name: String) -> Result<String, String> {
        let cl = client().lock().await;
        let prompts = cl
            .list_prompts(&server_name)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::to_string(&prompts).map_err(|e| e.to_string())
    }

    pub async fn mcp_approve_tool(request_id: String) -> Result<(), String> {
        let cl = client().lock().await;
        let id = uuid::Uuid::parse_str(&request_id).map_err(|e| e.to_string())?;
        cl.approvals.approve(id).await.map_err(|e| e.to_string())
    }

    pub async fn mcp_reject_tool(request_id: String, reason: String) -> Result<(), String> {
        let cl = client().lock().await;
        let id = uuid::Uuid::parse_str(&request_id).map_err(|e| e.to_string())?;
        cl.approvals.reject(id, &reason).await.map_err(|e| e.to_string())
    }

    pub async fn mcp_pending_approvals() -> Result<String, String> {
        let cl = client().lock().await;
        let pending = cl.approvals.pending_approvals().await;
        serde_json::to_string(&pending).map_err(|e| e.to_string())
    }

    pub async fn mcp_list_permissions() -> Result<String, String> {
        let cl = client().lock().await;
        let permissions = cl.permissions.list_permissions().await;
        serde_json::to_string(&permissions).map_err(|e| e.to_string())
    }

    pub async fn mcp_set_permission(server: String, tool: String, level: String) -> Result<(), String> {
        let cl = client().lock().await;
        let access = match level.as_str() {
            "read_only" => AccessLevel::ReadOnly,
            "read_write" => AccessLevel::ReadWrite,
            "destructive" => AccessLevel::Destructive,
            _ => AccessLevel::Custom(level),
        };
        cl.permissions.set_permission(&server, &tool, access).await;
        Ok(())
    }

    pub async fn mcp_get_server_log(server_name: String) -> Result<String, String> {
        Ok(format!("[log] Server '{}' - no log data available", server_name))
    }
}
