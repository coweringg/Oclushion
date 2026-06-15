import { describe, expect, it } from "vitest";

import { PromptBuilder } from "./prompt-builder";
import { packRepositoryContext, createMockSourceFiles } from "./context.service";
import { mockSkillpacks } from "./skillpacks/skillpack.manager";

describe("PromptBuilder", () => {
  it("injects active skillpack rules, forbidden patterns and repo context", () => {
    const prompt = new PromptBuilder().buildSystemPrompt(mockSkillpacks[1]!, {
      repo: {
        detectedLanguage: "TypeScript",
        detectedFramework: "Tauri",
        isMonorepo: true,
        totalFiles: 42,
        repoSummary: "Desktop shell with <native> repo access.",
      },
      userTask: "Review the command runner for XSS & command injection.",
      repositoryContext: packRepositoryContext(createMockSourceFiles(), 200),
    });

    expect(prompt).toContain("<role>Auditor de Seguridad (CSO) (security-auditor)</role>");
    expect(prompt).toContain("<rule>Prefer fail-closed behavior for security-sensitive flows.</rule>");
    expect(prompt).toContain("<pattern>Raw HTML insertion without escaping</pattern>");
    expect(prompt).toContain("<style>review-first</style>");
    expect(prompt).toContain("<framework>Tauri</framework>");
    expect(prompt).toContain("XSS &amp; command injection");
    expect(prompt).toContain("Desktop shell with &lt;native&gt; repo access.");
    expect(prompt).toContain("<repository_context used_tokens=");
    expect(prompt).toContain('<file path="src/api/controllers/user.controller.ts"');
  });
});
