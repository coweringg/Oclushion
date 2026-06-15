use crate::{Result, ToolCallResult, ToolContent, ToolDefinition};
use std::path::PathBuf;

pub struct GitMcpServer {
    repo_path: PathBuf,
}

impl GitMcpServer {
    pub fn new(repo_path: PathBuf) -> Self {
        Self { repo_path }
    }

    pub fn get_tools() -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "git_status".to_string(),
                description: "Returns the current git repository status".to_string(),
                input_schema: serde_json::json!({}),
            },
            ToolDefinition {
                name: "git_diff".to_string(),
                description: "Returns the current git diff (unstaged changes)".to_string(),
                input_schema: serde_json::json!({}),
            },
            ToolDefinition {
                name: "git_log".to_string(),
                description: "Returns the recent commit log".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Number of commits to show (default 10)"
                        }
                    }
                }),
            },
            ToolDefinition {
                name: "git_branch_list".to_string(),
                description: "Lists all branches in the repository".to_string(),
                input_schema: serde_json::json!({}),
            },
            ToolDefinition {
                name: "git_blame".to_string(),
                description: "Shows blame information for a file".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path to the file"
                        }
                    },
                    "required": ["file_path"]
                }),
            },
        ]
    }

    pub async fn handle_tool(&self, name: &str, args: serde_json::Value) -> Result<ToolCallResult> {
        match name {
            "git_status" => self.exec_git(&["status", "--short"]).await,
            "git_diff" => self.exec_git(&["diff"]).await,
            "git_log" => {
                let limit = args.get("limit").and_then(|v| v.as_i64()).unwrap_or(10);
                self.exec_git(&["log", &format!("--max-count={}", limit), "--oneline"])
                    .await
            }
            "git_branch_list" => self.exec_git(&["branch", "-a"]).await,
            "git_blame" => {
                let path = args.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
                if path.is_empty() {
                    return Ok(ToolCallResult {
                        content: vec![ToolContent::Text(
                            "file_path argument is required".to_string(),
                        )],
                        is_error: true,
                    });
                }
                self.exec_git(&["blame", path]).await
            }
            _ => Ok(ToolCallResult {
                content: vec![ToolContent::Text(format!("Unknown tool: {}", name))],
                is_error: true,
            }),
        }
    }

    async fn exec_git(&self, args: &[&str]) -> Result<ToolCallResult> {
        let output = tokio::process::Command::new("git")
            .args(args)
            .current_dir(&self.repo_path)
            .output()
            .await?;

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
}
