import { describe, expect, it } from "vitest";

import { ShipperService } from "./shipper.service";
import type { DeployProviderAdapter, DeployState } from "./shipper.types";

const successProvider: DeployProviderAdapter = {
  async trigger(_config, commitHash) {
    return state("deploy-1", "queued", commitHash);
  },
  async getStatus() {
    return { ...state("deploy-1", "success", "abc123"), url: "https://app.example.com" };
  },
  async rollback() {
    return state("deploy-1", "rolled-back", "abc123");
  },
};

describe("ShipperService", () => {
  it("runs git workflow, deploys and canary-checks production", async () => {
    const commands: string[] = [];
    const shipper = new ShipperService(
      {
        async runCommand(input) {
          commands.push([input.command, ...(input.args ?? [])].join(" "));
          return {
            command: input.command,
            args: input.args ?? [],
            exitCode: 0,
            stdout: input.args?.[0] === "rev-parse" ? "abc123\n" : "",
            stderr: "",
            autoExecuted: true,
            timedOut: false,
            truncated: false,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        },
      },
      { vercel: successProvider },
      () => undefined,
      async () => new Response("ok", { status: 200 }),
    );

    const result = await shipper.ship({
      workspacePath: "repo",
      branchName: "ai/task",
      commitMessage: "feat(app): ship task",
      config: { provider: "vercel", token: "token", projectId: "app", productionBranch: "main" },
    });

    expect(result.status).toBe("success");
    expect(commands).toContain("git commit -m feat(app): ship task");
    expect(commands).toContain("git push origin ai/task");
  });
});

function state(id: string, status: DeployState["status"], commitHash: string): DeployState {
  return {
    id,
    provider: "vercel",
    status,
    commitHash,
    startedAt: new Date().toISOString(),
    logs: [],
  };
}
