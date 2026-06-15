import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.url === "/v1/chat/completions" || req.url === "/v1/messages") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: "Mock response" } }] }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(8090, () => {
  process.stdout.write("Mock upstream listening on 8090\n");
});
