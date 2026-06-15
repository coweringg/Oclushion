import { describe, expect, it } from "vitest";

import { parseAssistantResponseForProposals } from "./safe-diff.service";

describe("parseAssistantResponseForProposals", () => {
  it("extracts fenced code blocks as proposals and keeps conversation text clean", () => {
    const parsed = parseAssistantResponseForProposals(
      [
        "Here is the safe change I recommend:",
        "",
        "```ts",
        "export const ok = true;",
        "```",
        "",
        "Run the verification command after review:",
        "",
        "```bash",
        "pnpm test",
        "```",
        "",
        "Approve only after reading the diff.",
      ].join("\n"),
    );

    expect(parsed.conversationText).toBe(
      [
        "Here is the safe change I recommend:",
        "",
        "Run the verification command after review:",
        "",
        "Approve only after reading the diff.",
      ].join("\n"),
    );
    expect(parsed.proposals).toHaveLength(2);
    expect(parsed.proposals[0]).toMatchObject({
      kind: "code",
      language: "ts",
      content: "export const ok = true;",
    });
    expect(parsed.proposals[1]).toMatchObject({
      kind: "command",
      language: "bash",
      content: "pnpm test",
    });
  });
});
