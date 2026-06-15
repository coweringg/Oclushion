import { McpStdioTransport, type JsonRpcRequest, type McpResource, type McpTool } from "./protocol";

export class OclushionMcpServer {
  private readonly transport = new McpStdioTransport();
  private readonly kanbanData = {
    tasks: [
      { id: "T-101", title: "Implementar OAuth2", status: "in-progress", assignee: "CursorUser" },
      { id: "T-102", title: "Fix memory leak", status: "todo", assignee: "CursorUser" }
    ]
  };

  private readonly teamData = {
    agents: [
      { role: "Backend Senior", status: "reviewing auth.ts" },
      { role: "QA Tester", status: "waiting for deployment" }
    ]
  };

  public start(): void {
    this.transport.onMessage = this.handleRequest.bind(this);
    this.transport.start();
  }

  private handleRequest(req: JsonRpcRequest): void {
    switch (req.method) {
      case "initialize":
        this.handleInitialize(req);
        break;
      case "resources/list":
        this.handleListResources(req);
        break;
      case "resources/read":
        this.handleReadResource(req);
        break;
      case "tools/list":
        this.handleListTools(req);
        break;
      case "tools/call":
        this.handleCallTool(req);
        break;
      default:
        this.transport.sendError(req.id, -32601, "Method not found");
    }
  }

  private handleInitialize(req: JsonRpcRequest): void {
    this.transport.sendResponse({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          resources: {},
          tools: {}
        },
        serverInfo: {
          name: "oclushion-server",
          version: "1.0.0"
        }
      }
    });
  }

  private handleListResources(req: JsonRpcRequest): void {
    const resources: McpResource[] = [
      {
        uri: "oclushion://kanban/active",
        name: "Active Kanban Tasks",
        description: "Returns the active tasks assigned to the user from Oclushion's Kanban board.",
        mimeType: "application/json"
      },
      {
        uri: "oclushion://team/status",
        name: "Team Status",
        description: "Returns the real-time status of all agents in the Oclushion workspace.",
        mimeType: "application/json"
      }
    ];

    this.transport.sendResponse({
      jsonrpc: "2.0",
      id: req.id,
      result: { resources }
    });
  }

  private handleReadResource(req: JsonRpcRequest): void {
    const uri = req.params?.uri;

    if (uri === "oclushion://kanban/active") {
      this.transport.sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(this.kanbanData, null, 2)
          }]
        }
      });
      return;
    }

    if (uri === "oclushion://team/status") {
      this.transport.sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(this.teamData, null, 2)
          }]
        }
      });
      return;
    }

    this.transport.sendError(req.id, -32602, "Invalid URI");
  }

  private handleListTools(req: JsonRpcRequest): void {
    const tools: McpTool[] = [
      {
        name: "submit_internal_review",
        description: "Submits local code changes to Oclushion's Tester Agent for pre-GitHub internal review.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            diff: { type: "string" },
            message: { type: "string" }
          },
          required: ["filePath", "diff"]
        }
      },
      {
        name: "report_blocker",
        description: "Reports that the user is stuck to Oclushion, updating their wellbeing status and pinging a Senior Agent.",
        inputSchema: {
          type: "object",
          properties: {
            reason: { type: "string" },
            timeBlockedMs: { type: "number" }
          },
          required: ["reason"]
        }
      }
    ];

    this.transport.sendResponse({
      jsonrpc: "2.0",
      id: req.id,
      result: { tools }
    });
  }

  private handleCallTool(req: JsonRpcRequest): void {
    const name = req.params?.name;
    const args = req.params?.arguments || {};

    if (name === "submit_internal_review") {
      this.transport.sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          content: [{
            type: "text",
            text: `Success! Code review requested for ${args.filePath}. The QA Agent will review it shortly.`
          }]
        }
      });
      return;
    }

    if (name === "report_blocker") {
      this.transport.sendResponse({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          content: [{
            type: "text",
            text: `Blocker reported: "${args.reason}". Oclushion Wellbeing Status updated to 'burnout_risk'. A Senior Agent has been notified.`
          }]
        }
      });
      return;
    }

    this.transport.sendError(req.id, -32601, "Tool not found");
  }
}

if (require.main === module) {
  const server = new OclushionMcpServer();
  server.start();
}
