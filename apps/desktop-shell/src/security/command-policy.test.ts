import { describe, expect, it } from "vitest";

import { evaluateCommand, hardenInstallCommand } from "./command-policy";

describe("command policy", () => {
  it("blocks destructive commands", () => {
    expect(evaluateCommand("rm", ["-rf", "/"])).toMatchObject({
      category: "destructive",
      riskLevel: "blocked",
      requiresApproval: false,
    });
  });

  it("marks package installs as high-risk approval commands", () => {
    expect(evaluateCommand("pnpm", ["install"])).toMatchObject({
      category: "install",
      riskLevel: "high",
      requiresApproval: true,
    });
  });

  it("adds ignore-scripts to package installs", () => {
    expect(hardenInstallCommand("pnpm", ["install"])).toEqual(["install", "--ignore-scripts"]);
    expect(hardenInstallCommand("pnpm", ["install", "--ignore-scripts"])).toEqual([
      "install",
      "--ignore-scripts",
    ]);
  });
});
