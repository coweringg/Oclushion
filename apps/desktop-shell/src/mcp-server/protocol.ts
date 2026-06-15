export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export class McpStdioTransport {
  public onMessage: ((msg: JsonRpcRequest) => void) | null = null;

  public start(): void {
    let buffer = "";

    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        if (line.trim()) {
          try {
            const req = JSON.parse(line) as JsonRpcRequest;
            if (this.onMessage) {
              this.onMessage(req);
            }
          } catch (e) {
            this.sendError(null, -32700, "Parse error");
          }
        }
      }
    });
  }

  public sendResponse(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + "\n");
  }

  public sendError(id: string | number | null, code: number, message: string, data?: any): void {
    this.sendResponse({
      jsonrpc: "2.0",
      id: id || -1,
      error: { code, message, data }
    });
  }
}
