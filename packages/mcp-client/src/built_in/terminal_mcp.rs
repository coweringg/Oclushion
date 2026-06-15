use crate::{Result, ToolCallResult, ToolContent, ToolDefinition};
use std::env;

pub struct TerminalMcpServer;

impl TerminalMcpServer {
    pub fn new() -> Self {
        Self
    }

    pub fn get_tools() -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "run_command".to_string(),
                description: "Runs a shell command and returns its output".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The command to run"
                        }
                    },
                    "required": ["command"]
                }),
            },
            ToolDefinition {
                name: "list_processes".to_string(),
                description: "Lists running processes".to_string(),
                input_schema: serde_json::json!({}),
            },
            ToolDefinition {
                name: "get_working_dir".to_string(),
                description: "Returns the current working directory".to_string(),
                input_schema: serde_json::json!({}),
            },
        ]
    }

    pub async fn handle_tool(&self, name: &str, args: serde_json::Value) -> Result<ToolCallResult> {
        match name {
            "run_command" => {
                let cmd = args
                    .get("command")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if cmd.is_empty() {
                    return Ok(ToolCallResult {
                        content: vec![ToolContent::Text(
                            "command argument is required".to_string(),
                        )],
                        is_error: true,
                    });
                }
                self.exec_command(cmd).await
            }
            "list_processes" => self.list_processes().await,
            "get_working_dir" => {
                let cwd = env::current_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| "<unknown>".to_string());
                Ok(ToolCallResult {
                    content: vec![ToolContent::Text(cwd)],
                    is_error: false,
                })
            }
            _ => Ok(ToolCallResult {
                content: vec![ToolContent::Text(format!("Unknown tool: {}", name))],
                is_error: true,
            }),
        }
    }

    async fn exec_command(&self, command: &str) -> Result<ToolCallResult> {
        let output = if cfg!(target_os = "windows") {
            tokio::process::Command::new("cmd")
                .args(["/C", command])
                .output()
                .await?
        } else {
            tokio::process::Command::new("sh")
                .args(["-c", command])
                .output()
                .await?
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        let mut content = Vec::new();
        if !stdout.is_empty() {
            content.push(ToolContent::Text(stdout));
        }
        if !stderr.is_empty() {
            content.push(ToolContent::Text(stderr));
        }
        if content.is_empty() {
            content.push(ToolContent::Text("(no output)".to_string()));
        }

        Ok(ToolCallResult {
            content,
            is_error: !output.status.success(),
        })
    }

    async fn list_processes(&self) -> Result<ToolCallResult> {
        let output = if cfg!(target_os = "windows") {
            tokio::process::Command::new("tasklist").output().await?
        } else {
            tokio::process::Command::new("ps").args(["aux"]).output().await?
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(ToolCallResult {
            content: vec![ToolContent::Text(stdout)],
            is_error: !output.status.success(),
        })
    }
}
