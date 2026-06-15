use std::collections::HashMap;

#[tokio::test]
async fn test_stdio_transport_start_stop() {
    let transport = mcp_client::transport::stdio::StdioTransport::new(
        "node",
        &[
            "-e".to_string(),
            r#"const rl=require('readline');const i=rl.createInterface({input:process.stdin,output:process.stdout});console.log('READY');i.on('line',l=>{try{const m=JSON.parse(l);console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{}}))}catch(e){}});"#.to_string(),
        ],
        HashMap::new(),
    );

    transport.start().await.unwrap();
    assert!(true, "Transport should start without error");

    transport.stop().await.unwrap();
    assert!(true, "Transport should stop without error");
}

#[tokio::test]
async fn test_stdio_send_receive() {
    let transport = mcp_client::transport::stdio::StdioTransport::new(
        "node",
        &[
            "-e".to_string(),
            r#"const rl=require('readline');const i=rl.createInterface({input:process.stdin,output:process.stdout});console.log('READY');i.on('line',l=>{try{const m=JSON.parse(l);console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{echo:m.params?.text||''}}))}catch(e){}});"#.to_string(),
        ],
        HashMap::new(),
    );

    transport.start().await.unwrap();

    let msg = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1u64,
        "method": "tools/call",
        "params": { "name": "echo", "arguments": { "text": "hello" } }
    });

    let response = transport.send(msg).await.unwrap();
    assert_eq!(response["jsonrpc"], "2.0");
    assert_eq!(response["id"], 1);
    assert!(response.get("result").is_some());

    transport.stop().await.unwrap();
}

#[tokio::test]
async fn test_stdio_ping() {
    let transport = mcp_client::transport::stdio::StdioTransport::new(
        "node",
        &[
            "-e".to_string(),
            r#"const rl=require('readline');const i=rl.createInterface({input:process.stdin,output:process.stdout});console.log('READY');i.on('line',l=>{try{const m=JSON.parse(l);console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{}}))}catch(e){}});"#.to_string(),
        ],
        HashMap::new(),
    );

    transport.start().await.unwrap();
    let ms = transport.ping().await.unwrap();
    assert!(ms < 5000, "Ping should be fast");
    transport.stop().await.unwrap();
}

#[tokio::test]
async fn test_stdio_multiple_requests() {
    let transport = mcp_client::transport::stdio::StdioTransport::new(
        "node",
        &[
            "-e".to_string(),
            r#"const rl=require('readline');let c=0;const i=rl.createInterface({input:process.stdin,output:process.stdout});console.log('READY');i.on('line',l=>{try{const m=JSON.parse(l);c++;console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{count:c}}))}catch(e){}});"#.to_string(),
        ],
        HashMap::new(),
    );

    transport.start().await.unwrap();

    for i in 1..=5 {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "id": i,
            "method": "test",
            "params": {}
        });
        let response = transport.send(msg).await.unwrap();
        assert_eq!(response["id"], i);
        assert_eq!(response["result"]["count"], i);
    }

    transport.stop().await.unwrap();
}
