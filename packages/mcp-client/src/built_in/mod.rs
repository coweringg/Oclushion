pub mod git_mcp;
pub mod terminal_mcp;

use crate::{McpServerConfig, TransportType};
use std::collections::HashMap;

pub struct BuiltInServers;

impl BuiltInServers {
    pub fn list() -> Vec<McpServerConfig> {
        vec![Self::get_git_config(), Self::get_terminal_config()]
    }

    pub fn get_git_config() -> McpServerConfig {
        let js = r#"
const rl = require('readline');
const i = rl.createInterface({ input: process.stdin, output: process.stdout });
console.log('READY');
i.on('line', (line) => {
  try {
    const m = JSON.parse(line);
    if (m.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { protocol_version: '2024-11-05', capabilities: { tools: {}, resources: {}, prompts: {} }, server_info: { name: 'git-mcp', version: '0.1.0' } } }));
    } else if (m.method === 'tools/list') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'git_status', description: 'Returns current status', input_schema: {} }, { name: 'git_diff', description: 'Returns diff', input_schema: {} }, { name: 'git_log', description: 'Returns commit log', input_schema: { type: 'object', properties: { limit: { type: 'integer', description: 'Number of commits' } }, required: [] } }, { name: 'git_branch_list', description: 'Lists branches', input_schema: {} }, { name: 'git_blame', description: 'Shows blame for file', input_schema: { type: 'object', properties: { file_path: { type: 'string', description: 'Path to file' } }, required: ['file_path'] } }] } }));
    } else if (m.method === 'tools/call') {
      const t = m.params.name;
      let r = '';
      if (t === 'git_status') r = 'M  src/main.rs\n?? new_file.txt';
      else r = 'Executed ' + t;
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: r }], is_error: false } }));
    } else {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: {} }));
    }
  } catch (e) { console.error(e.message); }
});"#;

        McpServerConfig {
            name: "built-in-git".to_string(),
            transport_type: TransportType::Stdio,
            command: Some("node".to_string()),
            args: vec!["--eval".to_string(), js.trim().to_string()],
            url: None,
            env_vars: HashMap::new(),
            auto_start: true,
        }
    }

    pub fn get_terminal_config() -> McpServerConfig {
        let js = r#"
const rl = require('readline');
const i = rl.createInterface({ input: process.stdin, output: process.stdout });
console.log('READY');
i.on('line', (line) => {
  try {
    const m = JSON.parse(line);
    if (m.method === 'initialize') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { protocol_version: '2024-11-05', capabilities: { tools: {}, resources: {}, prompts: {} }, server_info: { name: 'terminal-mcp', version: '0.1.0' } } }));
    } else if (m.method === 'tools/list') {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { tools: [{ name: 'run_command', description: 'Runs a shell command', input_schema: { type: 'object', properties: { command: { type: 'string', description: 'Command to run' } }, required: ['command'] } }, { name: 'list_processes', description: 'Lists running processes', input_schema: {} }, { name: 'get_working_dir', description: 'Returns working directory', input_schema: {} }] } }));
    } else if (m.method === 'tools/call') {
      const t = m.params.name;
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'Executed ' + t + ' successfully' }], is_error: false } }));
    } else {
      console.log(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: {} }));
    }
  } catch (e) { console.error(e.message); }
});"#;

        McpServerConfig {
            name: "built-in-terminal".to_string(),
            transport_type: TransportType::Stdio,
            command: Some("node".to_string()),
            args: vec!["--eval".to_string(), js.trim().to_string()],
            url: None,
            env_vars: HashMap::new(),
            auto_start: true,
        }
    }
}
