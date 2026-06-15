import { z } from "zod";
import type { MCPRegistry } from "./mcp-registry";
import type { MCPContextSource, MCPReference } from "./mcp.types";

const notionTitlePropertySchema = z.object({
  type: z.string().optional(),
  title: z.array(z.object({ plain_text: z.string().optional() })).optional(),
});

const githubResponseSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  html_url: z.string().optional(),
});

const linearResponseSchema = z.object({
  data: z.object({
    issue: z.object({
      identifier: z.string(),
      title: z.string(),
      description: z.string().optional(),
      url: z.string().optional(),
    }).optional(),
  }).optional(),
});

const notionResponseSchema = z.object({
  url: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export class MCPClient {
  public constructor(private readonly registry: MCPRegistry) {}

  public async fetchReference(reference: MCPReference): Promise<MCPContextSource | null> {
    const config = await this.registry.getWithToken(reference.provider);
    if (!config.enabled || !config.apiToken) {
      return null;
    }
    if (reference.provider === "github") {
      return this.fetchGitHub(reference, config.apiToken);
    }
    if (reference.provider === "linear") {
      return this.fetchLinear(reference, config.apiToken);
    }
    return this.fetchNotion(reference, config.apiToken);
  }

  private async fetchGitHub(reference: MCPReference, token: string): Promise<MCPContextSource> {
    const match = reference.url?.match(
      /^https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/(issues|pull)\/(\d+)$/iu,
    );
    if (!match) {
      throw new Error("Invalid GitHub reference.");
    }
    const [, owner, repo, kind, number] = match;
    const endpoint =
      kind === "pull"
        ? `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`
        : `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      throw new Error(`GitHub MCP fetch failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = githubResponseSchema.parse(raw);
    return {
      provider: "github",
      id: reference.id,
      title: payload.title ?? reference.id,
      content: payload.body ?? "",
      url: payload.html_url ?? reference.url,
    };
  }

  private async fetchLinear(reference: MCPReference, token: string): Promise<MCPContextSource> {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "query Issue($id: String!) { issue(id: $id) { identifier title description url } }",
        variables: { id: reference.id },
      }),
    });
    if (!response.ok) {
      throw new Error(`Linear MCP fetch failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = linearResponseSchema.parse(raw);
    const issue = payload.data?.issue;
    return {
      provider: "linear",
      id: issue?.identifier ?? reference.id,
      title: issue?.title ?? reference.id,
      content: issue?.description ?? "",
      url: issue?.url,
    };
  }

  private async fetchNotion(reference: MCPReference, token: string): Promise<MCPContextSource> {
    const rawId = reference.id.replaceAll("-", "");
    if (!/^[a-f0-9]{32}$/i.test(rawId)) {
      throw new Error(`Invalid Notion page ID: ${reference.id}`);
    }
    const pageId = rawId;
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      },
    });
    if (!response.ok) {
      throw new Error(`Notion MCP fetch failed with HTTP ${response.status}`);
    }
    const raw = await response.json();
    const payload = notionResponseSchema.parse(raw);
    return {
      provider: "notion",
      id: pageId,
      title: extractNotionTitle(payload.properties) ?? "Notion page",
      content: JSON.stringify(payload.properties ?? {}),
      url: payload.url ?? reference.url,
    };
  }
}

function extractNotionTitle(properties: Record<string, unknown> | undefined): string | null {
  const values = Object.values(properties ?? {});
  for (const value of values) {
    const parsed = notionTitlePropertySchema.safeParse(value);
    if (parsed.success && parsed.data.type === "title") {
      return parsed.data.title?.map((part) => part.plain_text ?? "").join("") || null;
    }
  }
  return null;
}
