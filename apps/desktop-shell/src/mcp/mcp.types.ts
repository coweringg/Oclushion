export type MCPProviderId = "github" | "linear" | "notion";

export type MCPServerConfig = {
  id: MCPProviderId;
  name: string;
  enabled: boolean;
  apiToken?: string;
  baseUrl?: string;
};

export type MCPReference = {
  provider: MCPProviderId;
  type: "issue" | "pull_request" | "page" | "ticket";
  id: string;
  url?: string;
};

export type MCPContextSource = {
  provider: MCPProviderId;
  id: string;
  title: string;
  content: string;
  url?: string;
};
