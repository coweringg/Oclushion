import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applySession, createProtectedWorkspace, diffSession } from "../src/index.js";

async function fixtureProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sano-agent-fixture-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, ".env"),
    "DATABASE_URL=postgresql://admin:password_secreta_123@localhost/prod",
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "app.ts"),
    "export const key = 'sk-proj-supersecreta123456789';\n",
    "utf8",
  );
  return root;
}

describe("Agent Protect workspace", () => {
  it("materializes a sanitized workspace without exposing blocked files", async () => {
    const project = await fixtureProject();
    const agentHome = await mkdtemp(path.join(os.tmpdir(), "sano-agent-home-"));
    process.env.SANO_AGENT_HOME = agentHome;

    const manifest = await createProtectedWorkspace({ projectPath: project });
    const app = await readFile(path.join(manifest.workspacePath, "src", "app.ts"), "utf8");

    expect(manifest.files.find((file) => file.relativePath === ".env")?.status).toBe("blocked");
    await expect(readFile(path.join(manifest.workspacePath, ".env"), "utf8")).rejects.toThrow();
    expect(app).toContain("SANO_TOKEN_APIKEY_0");
    expect(app).not.toContain("sk-proj-supersecreta");

    const publicMetadata = await readFile(
      path.join(manifest.workspacePath, ".sano-agent.json"),
      "utf8",
    );
    expect(publicMetadata).not.toContain("sk-proj-supersecreta");
  });

  it("applies workspace edits while restoring local secret tokens", async () => {
    const project = await fixtureProject();
    const agentHome = await mkdtemp(path.join(os.tmpdir(), "sano-agent-home-"));
    process.env.SANO_AGENT_HOME = agentHome;
    const manifest = await createProtectedWorkspace({ projectPath: project });
    const workspaceFile = path.join(manifest.workspacePath, "src", "app.ts");
    const current = await readFile(workspaceFile, "utf8");
    await writeFile(workspaceFile, `${current}export const rotated = SANO_TOKEN_APIKEY_0;\n`, "utf8");

    expect((await diffSession(manifest.id)).changed).toEqual(["src/app.ts"]);
    const applied = await applySession(manifest.id);
    const originalFile = await readFile(path.join(project, "src", "app.ts"), "utf8");

    expect(applied.applied).toEqual(["src/app.ts"]);
    expect(originalFile).toContain("sk-proj-supersecreta123456789");
    expect(originalFile).not.toContain("SANO_TOKEN_APIKEY_0");
  });
});
