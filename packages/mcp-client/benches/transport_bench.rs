use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::collections::HashMap;

fn bench_stdio_message_roundtrip(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let transport = rt.block_on(async {
        let t = mcp_client::transport::stdio::StdioTransport::new(
            "node",
            &[
                "-e".to_string(),
                r#"const rl=require('readline');const i=rl.createInterface({input:process.stdin,output:process.stdout});console.log('READY');i.on('line',l=>{try{const m=JSON.parse(l);console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{}}))}catch(e){}});"#.to_string(),
            ],
            HashMap::new(),
        );
        t.start().await.unwrap();
        t
    });

    c.bench_function("stdio_message_roundtrip", |b| {
        b.to_async(&rt).iter(|| async {
            let msg = serde_json::json!({
                "jsonrpc": "2.0",
                "id": black_box(1u64),
                "method": "test",
                "params": {}
            });
            let response = transport.send(msg).await.unwrap();
            black_box(response);
        })
    });

    rt.block_on(transport.stop()).unwrap();
}

fn bench_json_serialize_deserialize(c: &mut Criterion) {
    use mcp_client::protocol::messages;

    let request = messages::create_request(
        1,
        messages::METHOD_CALL_TOOL,
        Some(serde_json::json!({
            "name": "git_status",
            "arguments": {}
        })),
    );

    c.bench_function("json_serialize_request", |b| {
        b.iter(|| {
            let json = serde_json::to_string(black_box(&request)).unwrap();
            black_box(json);
        })
    });

    let response_json = r#"{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"M src/main.rs"}],"is_error":false}}"#;

    c.bench_function("json_deserialize_response", |b| {
        b.iter(|| {
            let parsed: serde_json::Value = serde_json::from_str(black_box(response_json)).unwrap();
            black_box(parsed);
        })
    });
}

criterion_group!(benches, bench_stdio_message_roundtrip, bench_json_serialize_deserialize);
criterion_main!(benches);
