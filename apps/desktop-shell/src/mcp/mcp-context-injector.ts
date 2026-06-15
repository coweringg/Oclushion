import type { SanoShield } from "../sano-shield.service";
import type { MCPClient } from "./mcp-client";
import type { MCPContextSource, MCPReference } from "./mcp.types";

const referencePatterns: Array<{
  regex: RegExp;
  provider: MCPReference["provider"];
  type: MCPReference["type"];
}> = [
  { regex: /\b[A-Z]{2,}-\d+\b/gu, provider: "linear", type: "ticket" },
  { regex: /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+/giu, provider: "github", type: "issue" },
  { regex: /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/giu, provider: "github", type: "pull_request" },
  { regex: /https:\/\/(?:www\.)?notion\.so\/[a-zA-Z0-9-]+/gu, provider: "notion", type: "page" },
];

export class MCPContextInjector {
  public constructor(
    private readonly client: MCPClient,
    private readonly shield: SanoShield,
  ) {}

  public detectReferences(text: string): MCPReference[] {
    return referencePatterns.flatMap((pattern) =>
      [...text.matchAll(pattern.regex)].map((match) => ({
        provider: pattern.provider,
        type: pattern.type,
        id: normalizeReferenceId(match[0], pattern.provider),
        url: match[0].startsWith("http") ? match[0] : undefined,
      })),
    );
  }

  public async buildContext(text: string): Promise<string> {
    const sources: MCPContextSource[] = [];
    for (const reference of this.detectReferences(text)) {
      const source = await this.client.fetchReference(reference);
      if (source) {
        sources.push(source);
      }
    }
    if (!sources.length) {
      return "";
    }
    const raw = `<mcp_context trust_boundary="external_untrusted">\n${sources.map(renderSource).join("\n")}\n</mcp_context>`;
    return this.shield.sanitize(raw).sanitizedText;
  }
}

function normalizeReferenceId(value: string, provider: MCPReference["provider"]): string {
  if (provider === "github") {
    return value;
  }
  if (provider === "notion") {
    return value.split("/").pop() ?? value;
  }
  return value;
}

function renderSource(source: MCPContextSource): string {
  return `<untrusted_external_context source="${escapeXmlAttribute(source.provider)}" id="${escapeXmlAttribute(source.id)}" url="${escapeXmlAttribute(source.url ?? "")}">
<title>${sanitizeExternalContent(source.title, 500)}</title>
<content>${sanitizeExternalContent(source.content, 8_000)}</content>
</untrusted_external_context>`;
}

function sanitizeExternalContent(value: string, maxLength: number): string {
  return value
    .slice(0, maxLength)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
