import { describe, expect, it } from "vitest";
import type { Skill } from "./marketplace.types";
import { SkillsDetector } from "./skills.detector";

describe("SkillsDetector", () => {
  it("suggests the strongest uninstalled skill based on user intent", async () => {
    const detector = new SkillsDetector();
    const suggestion = await detector.suggest(
      "Audit this endpoint for OWASP auth, injection and XSS issues",
      [freeSkill("security-owasp", "security", ["owasp", "xss", "injection"]), freeSkill("database-staff", "data", ["postgres"])],
      [],
    );

    expect(suggestion?.skill.id).toBe("security-owasp");
    expect(suggestion?.matchedKeywords).toEqual(expect.arrayContaining(["owasp", "xss", "injection"]));
  });

  it("does not suggest a skill that is already installed", async () => {
    const detector = new SkillsDetector();
    const suggestion = await detector.suggest(
      "Review OWASP risks",
      [freeSkill("security-owasp", "security", ["owasp"])],
      ["security-owasp"],
    );

    expect(suggestion).toBeNull();
  });

  it("does not suggest pro skills to free users", async () => {
    const detector = new SkillsDetector();
    const proSkill = skill("security-owasp", "security", ["owasp"]);
    proSkill.tier = "pro";
    const suggestion = await detector.suggest(
      "Audit for OWASP vulnerabilities",
      [proSkill],
      [],
      "Free",
    );

    expect(suggestion).toBeNull();
  });

  it("suggests pro skills to pro users", async () => {
    const detector = new SkillsDetector();
    const proSkill = skill("security-owasp", "security", ["owasp", "security", "audit"]);
    const suggestion = await detector.suggest(
      "Audit for OWASP vulnerabilities",
      [proSkill],
      [],
      "Pro",
    );

    expect(suggestion?.skill.id).toBe("security-owasp");
  });

  it("suggests pro skills to enterprise users", async () => {
    const detector = new SkillsDetector();
    const proSkill = skill("security-owasp", "security", ["owasp", "security", "audit"]);
    const suggestion = await detector.suggest(
      "Audit for OWASP vulnerabilities",
      [proSkill],
      [],
      "Enterprise",
    );

    expect(suggestion?.skill.id).toBe("security-owasp");
  });

  it("does not suggest enterprise skills to free or pro users", async () => {
    const detector = new SkillsDetector();
    const entSkill = enterpriseSkill("ent-advanced", "security", ["owasp", "advanced", "security"]);

    const freeSuggestion = await detector.suggest(
      "Advanced OWASP audit",
      [entSkill],
      [],
      "Free",
    );
    expect(freeSuggestion).toBeNull();

    const proSuggestion = await detector.suggest(
      "Advanced OWASP audit",
      [entSkill],
      [],
      "Pro",
    );
    expect(proSuggestion).toBeNull();
  });

  it("suggests enterprise skills to enterprise users", async () => {
    const detector = new SkillsDetector();
    const entSkill = enterpriseSkill("ent-advanced", "security", ["owasp", "advanced", "security"]);
    const suggestion = await detector.suggest(
      "Advanced OWASP audit",
      [entSkill],
      [],
      "Enterprise",
    );

    expect(suggestion?.skill.id).toBe("ent-advanced");
  });

  it("defaults to free tier when userTier is undefined", async () => {
    const detector = new SkillsDetector();
    const proSkill = skill("security-owasp", "security", ["owasp", "security", "audit"]);
    const suggestion = await detector.suggest(
      "Audit for OWASP vulnerabilities",
      [proSkill],
      [],
    );

    expect(suggestion).toBeNull();
  });
});

function freeSkill(id: string, category: Skill["category"], keywords: string[]): Skill {
  return {
    id,
    name: id,
    description: id,
    category,
    tier: "free",
    version: "1.0.0",
    downloadUrl: `https://cdn.oclushion.com/skills/${id}.md`,
    sha256: "a".repeat(64),
    sizeKb: 1,
    keywords,
    previewLines: [],
  };
}

function skill(id: string, category: Skill["category"], keywords: string[]): Skill {
  return {
    id,
    name: id,
    description: id,
    category,
    tier: "pro",
    version: "1.0.0",
    downloadUrl: `https://cdn.oclushion.com/skills/${id}.md`,
    sha256: "a".repeat(64),
    sizeKb: 1,
    keywords,
    previewLines: [],
  };
}

function enterpriseSkill(id: string, category: Skill["category"], keywords: string[]): Skill {
  return {
    id,
    name: id,
    description: id,
    category,
    tier: "enterprise",
    version: "1.0.0",
    downloadUrl: `https://cdn.oclushion.com/skills/${id}.md`,
    sha256: "a".repeat(64),
    sizeKb: 1,
    keywords,
    previewLines: [],
  };
}
