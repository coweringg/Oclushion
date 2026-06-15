use mcp_client::{AccessLevel, ToolDefinition};
use mcp_client::security::permissions::PermissionManager;

#[tokio::test]
async fn test_default_permission_is_read_only() {
    let pm = PermissionManager::new();
    let level = pm.get_permission("any-server", "any-tool").await;
    assert_eq!(level, AccessLevel::ReadOnly);
}

#[tokio::test]
async fn test_set_and_get_permission() {
    let pm = PermissionManager::new();
    pm.set_permission("server-a", "tool-x", AccessLevel::Destructive).await;
    let level = pm.get_permission("server-a", "tool-x").await;
    assert_eq!(level, AccessLevel::Destructive);
}

#[tokio::test]
async fn test_can_execute_allows_read_only() {
    let pm = PermissionManager::new();
    pm.set_permission("srv", "read_tool", AccessLevel::ReadOnly).await;
    let result = pm.can_execute("srv", "read_tool").await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_permission_isolation() {
    let pm = PermissionManager::new();
    pm.set_permission("server1", "tool_a", AccessLevel::Destructive).await;
    pm.set_permission("server2", "tool_b", AccessLevel::ReadWrite).await;

    assert_eq!(pm.get_permission("server1", "tool_a").await, AccessLevel::Destructive);
    assert_eq!(pm.get_permission("server2", "tool_b").await, AccessLevel::ReadWrite);
    assert_eq!(pm.get_permission("server1", "tool_b").await, AccessLevel::ReadOnly);
}

#[tokio::test]
async fn test_custom_permission() {
    let pm = PermissionManager::new();
    pm.set_permission("srv", "custom_tool", AccessLevel::Custom("requires admin".to_string())).await;

    let result = pm.can_execute("srv", "custom_tool").await;
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("requires admin"));
}

#[tokio::test]
async fn test_list_permissions() {
    let pm = PermissionManager::new();
    pm.set_permission("s1", "t1", AccessLevel::ReadOnly).await;
    pm.set_permission("s1", "t2", AccessLevel::Destructive).await;

    let perms = pm.list_permissions().await;
    assert_eq!(perms.len(), 2);
}

#[tokio::test]
async fn test_classify_tool_by_name() {
    let read_tool = ToolDefinition {
        name: "get_list".to_string(),
        description: "".to_string(),
        input_schema: serde_json::json!({}),
    };
    assert_eq!(
        PermissionManager::classify_tool(&read_tool),
        AccessLevel::ReadOnly
    );

    let destructive_tool = ToolDefinition {
        name: "delete_record".to_string(),
        description: "".to_string(),
        input_schema: serde_json::json!({}),
    };
    assert_eq!(
        PermissionManager::classify_tool(&destructive_tool),
        AccessLevel::Destructive
    );

    let neutral_tool = ToolDefinition {
        name: "process_data".to_string(),
        description: "".to_string(),
        input_schema: serde_json::json!({}),
    };
    assert_eq!(
        PermissionManager::classify_tool(&neutral_tool),
        AccessLevel::ReadWrite
    );
}

#[tokio::test]
async fn test_save_and_load_permissions() {
    let dir = std::env::temp_dir();
    let path = dir.join(format!("test_perms_{}.json", uuid::Uuid::new_v4()));

    {
        let pm = PermissionManager::new();
        pm.set_permission("svr", "tool", AccessLevel::Destructive).await;
        pm.save(&path).await.unwrap();
    }

    let loaded = PermissionManager::load(&path).await.unwrap();
    assert_eq!(
        loaded.get_permission("svr", "tool").await,
        AccessLevel::Destructive
    );

    let _ = tokio::fs::remove_file(&path).await;
}
