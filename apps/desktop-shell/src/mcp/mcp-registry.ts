import { z } from "zod";
import type { KeyValueStore } from "../persistent-store";
import { logger } from "../utils/logger";
import { secureKeysService } from "../llm/secure-keys.service";
import type { MCPProviderId, MCPServerConfig } from "./mcp.types";

const mcpConfigKey = "oclushion.v2.mcp.config";

const McpServerConfigSchema = z.object({
  id: z.string().max(128),
  name: z.string().min(1).max(100),
  enabled: z.boolean(),
  baseUrl: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("https://") || url.startsWith("http://localhost"),
      "MCP URL must use HTTPS (or http://localhost for dev only)",
    )
    .optional(),
  apiToken: z.string().max(2048).optional(),
  type: z.enum(["cloud", "local", "local-authenticated", "self-hosted"]).optional(),
  npmPackage: z.string().max(256).optional(),
  command: z.string().max(256).optional(),
  args: z.array(z.string().max(256)).max(16).optional(),
  env: z.record(z.string(), z.string().max(1024)).refine(
    (val) => Object.keys(val).length <= 16,
    { message: "Environment map must have at most 16 entries" },
  ).optional(),
});

const McpConfigSchema = z.object({
  servers: z.array(McpServerConfigSchema).max(24),
  enabledServers: z.array(z.string().max(128)).max(24),
  isCloudSynced: z.boolean(),
  lastToggledId: z.string().max(128).optional(),
});

export const defaultMcpServers: MCPServerConfig[] = [
  { id: "github", name: "GitHub", enabled: false, baseUrl: "https://api.github.com" },
  { id: "linear", name: "Linear", enabled: false, baseUrl: "https://api.linear.app/graphql" },
  { id: "notion", name: "Notion", enabled: false, baseUrl: "https://api.notion.com/v1" },
];

export class MCPRegistry {
  private servers: MCPServerConfig[] = defaultMcpServers;

  private constructor(
    private readonly store: KeyValueStore,
    private readonly secureKeys = secureKeysService,
  ) {}

  public static async create(store: KeyValueStore): Promise<MCPRegistry> {
    const registry = new MCPRegistry(store);
    await registry.load();
    return registry;
  }

  public list(): MCPServerConfig[] {
    return this.servers.map((server) => ({ ...server, apiToken: server.apiToken ? "********" : "" }));
  }

  public get(id: MCPProviderId): MCPServerConfig {
    const server = this.servers.find((candidate) => candidate.id === id);
    if (!server) {
      throw new Error(`Unknown MCP server: ${id}`);
    }
    return { ...server, apiToken: server.apiToken };
  }

  public async getWithToken(id: MCPProviderId): Promise<MCPServerConfig> {
    const server = this.servers.find((candidate) => candidate.id === id);
    if (!server) {
      throw new Error(`Unknown MCP server: ${id}`);
    }
    const token = await this.secureKeys.loadKey("apikey", `mcp.${id}`);
    return { ...server, apiToken: token ?? server.apiToken };
  }

  public async configure(input: MCPServerConfig): Promise<void> {
    this.servers = this.servers.map((server) =>
      server.id === input.id ? { ...server, ...input, apiToken: input.apiToken ?? server.apiToken } : server,
    );
    if (input.apiToken) {
      await this.secureKeys.saveKey("apikey", `mcp.${input.id}`, input.apiToken);
    }
    await this.persist();
  }

  private async load(): Promise<void> {
    const raw = await this.store.getItem(mcpConfigKey);
    if (!raw) {
      return;
    }
    try {
      const parsedRaw = z.array(z.unknown()).safeParse(JSON.parse(raw));
      if (!parsedRaw.success) {
        logger.warn("mcp-registry", "MCP config is not an array, resetting to defaults");
        await this.store.removeItem(mcpConfigKey);
        return;
      }
      const parsed = parsedRaw.data;
      this.servers = defaultMcpServers.map((server) => {
        const stored = parsed.find((candidate: any) => candidate?.id === server.id);
        if (!stored) return server;
        const result = McpServerConfigSchema.safeParse(stored);
        if (!result.success) {
          logger.warn("mcp-registry", `Invalid config for server ${server.id}, using defaults`);
          return server;
        }
        return { ...server, ...result.data, apiToken: result.data.apiToken ?? server.apiToken } as MCPServerConfig;
      });
      await this.hydrateTokensFromKeychain();
    } catch (error) {
      logger.warn("mcp-registry", "Failed to load MCP config, resetting to defaults", error);
      await this.store.removeItem(mcpConfigKey);
    }
  }

  private async hydrateTokensFromKeychain(): Promise<void> {
    const hydrated = await Promise.all(
      this.servers.map(async (server) => {
        if (server.apiToken && server.apiToken !== "***") {
          return server;
        }
        const token = await this.secureKeys.loadKey("apikey", `mcp.${server.id}`);
        return token ? { ...server, apiToken: token } : server;
      }),
    );
    this.servers = hydrated;
  }

  private async persist(): Promise<void> {
    const sanitized = this.servers.map((s) => ({
      ...s,
      apiToken: s.apiToken ? "***" : "",
    }));
    await this.store.setItem(mcpConfigKey, JSON.stringify(sanitized));
  }
}

type McpConfig = z.infer<typeof McpConfigSchema>;
