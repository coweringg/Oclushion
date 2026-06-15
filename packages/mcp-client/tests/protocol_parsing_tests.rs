use mcp_client::protocol::messages;

#[test]
fn test_parse_initialize_request() {
    let json = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocol_version": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": {},
                "prompts": {}
            },
            "client_info": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    }"#;

    let req: messages::JsonRpcRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.jsonrpc, "2.0");
    assert_eq!(req.id, 1);
    assert_eq!(req.method, "initialize");

    let params = req.params.unwrap();
    assert_eq!(params["protocol_version"], "2024-11-05");
    assert_eq!(params["client_info"]["name"], "test-client");
}

#[test]
fn test_build_tools_list_request() {
    let req = messages::create_request(42, messages::METHOD_LIST_TOOLS, None);
    let json = serde_json::to_string(&req).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

    assert_eq!(parsed["jsonrpc"], "2.0");
    assert_eq!(parsed["id"], 42);
    assert_eq!(parsed["method"], "tools/list");
    assert_eq!(parsed["params"], serde_json::Value::Null);
}

#[test]
fn test_parse_tools_list_response() {
    let json = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "tools": [
                {
                    "name": "echo",
                    "description": "Echoes input",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "text": { "type": "string" }
                        },
                        "required": ["text"]
                    }
                }
            ]
        }
    }"#;

    let resp: messages::JsonRpcResponse = serde_json::from_str(json).unwrap();
    assert!(resp.error.is_none());

    let tools = resp.result.unwrap();
    let tool_list = tools["tools"].as_array().unwrap();
    assert_eq!(tool_list.len(), 1);
    assert_eq!(tool_list[0]["name"], "echo");
}

#[test]
fn test_parse_call_tool_request() {
    let json = r#"{
        "jsonrpc": "2.0",
        "id": 10,
        "method": "tools/call",
        "params": {
            "name": "git_status",
            "arguments": {}
        }
    }"#;

    let req: messages::JsonRpcRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.method, "tools/call");
    let params = req.params.unwrap();
    assert_eq!(params["name"], "git_status");
}

#[test]
fn test_parse_error_response() {
    let json = r#"{
        "jsonrpc": "2.0",
        "id": 99,
        "error": {
            "code": -32601,
            "message": "Method not found"
        }
    }"#;

    let resp: messages::JsonRpcResponse = serde_json::from_str(json).unwrap();
    assert!(resp.result.is_none());
    let err = resp.error.unwrap();
    assert_eq!(err.code, -32601);
    assert_eq!(err.message, "Method not found");
}

#[test]
fn test_parse_initialize_result() {
    let json = r#"{
        "protocol_version": "2024-11-05",
        "capabilities": {
            "tools": {},
            "resources": {},
            "prompts": {}
        },
        "server_info": {
            "name": "test-server",
            "version": "0.1.0"
        }
    }"#;

    let result: messages::InitializeResult = serde_json::from_str(json).unwrap();
    assert_eq!(result.protocol_version, "2024-11-05");
    assert_eq!(result.server_info.name, "test-server");
}

#[test]
fn test_parse_list_resources_response() {
    let json = r#"{
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "resources": [
                {
                    "uri": "file:///test.txt",
                    "name": "Test File",
                    "description": "A test file",
                    "mimeType": "text/plain"
                }
            ]
        }
    }"#;

    let resp: messages::JsonRpcResponse = serde_json::from_str(json).unwrap();
    let result = resp.result.unwrap();
    let resources = result["resources"].as_array().unwrap();
    assert_eq!(resources.len(), 1);
    assert_eq!(resources[0]["uri"], "file:///test.txt");
    assert_eq!(resources[0]["mimeType"], "text/plain");
}

#[test]
fn test_method_constants() {
    assert_eq!(messages::METHOD_INITIALIZE, "initialize");
    assert_eq!(messages::METHOD_LIST_TOOLS, "tools/list");
    assert_eq!(messages::METHOD_CALL_TOOL, "tools/call");
    assert_eq!(messages::METHOD_LIST_RESOURCES, "resources/list");
    assert_eq!(messages::METHOD_READ_RESOURCE, "resources/read");
    assert_eq!(messages::METHOD_LIST_PROMPTS, "prompts/list");
    assert_eq!(messages::METHOD_GET_PROMPT, "prompts/get");
    assert_eq!(messages::METHOD_SHUTDOWN, "shutdown");
}

#[test]
fn test_create_notification() {
    let notif = messages::create_notification("notifications/initialized", None);
    let json = serde_json::to_value(&notif).unwrap();
    assert_eq!(json["jsonrpc"], "2.0");
    assert_eq!(json["method"], "notifications/initialized");
    assert!(json.get("id").is_none());
}
