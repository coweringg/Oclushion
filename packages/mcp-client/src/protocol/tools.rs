use crate::{McpError, Result, ToolDefinition};
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct ToolRegistry {
    tools: HashMap<String, Vec<ToolDefinition>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn register_tool(&mut self, server: &str, tool: ToolDefinition) {
        self.tools
            .entry(server.to_string())
            .or_default()
            .push(tool);
    }

    pub fn get_tool(&self, name: &str) -> Option<(String, ToolDefinition)> {
        for (server, tools) in &self.tools {
            for tool in tools {
                if tool.name == name {
                    return Some((server.clone(), tool.clone()));
                }
            }
        }
        None
    }

    pub fn list_all(&self) -> Vec<(String, ToolDefinition)> {
        let mut result = Vec::new();
        for (server, tools) in &self.tools {
            for tool in tools {
                result.push((server.clone(), tool.clone()));
            }
        }
        result
    }

    pub fn list_for_server(&self, server: &str) -> Vec<ToolDefinition> {
        self.tools.get(server).cloned().unwrap_or_default()
    }

    pub fn register_server_tools(&mut self, server: &str, tools: Vec<ToolDefinition>) {
        self.tools.insert(server.to_string(), tools);
    }

    pub fn validate_tool_call(&self, name: &str, args: &serde_json::Value) -> Result<()> {
        let tool = self
            .get_tool(name)
            .ok_or_else(|| McpError::ToolNotFound(format!("Tool '{}' not found in any server", name)))?;

        let schema = &tool.1.input_schema;
        if schema.is_null() || !schema.is_object() {
            return Ok(());
        }

        let required = schema["required"].as_array();
        if let Some(required_fields) = required {
            if let Some(obj) = args.as_object() {
                for field in required_fields {
                    let field_name = field.as_str().unwrap_or("");
                    if !obj.contains_key(field_name) {
                        return Err(McpError::ProtocolError(format!(
                            "Missing required field '{}' for tool '{}'",
                            field_name, name
                        )));
                    }
                }
            } else if !required_fields.is_empty() {
                return Err(McpError::ProtocolError(format!(
                    "Arguments must be an object for tool '{}'",
                    name
                )));
            }
        }
        Ok(())
    }

    pub fn remove_server_tools(&mut self, server: &str) {
        self.tools.remove(server);
    }
}
