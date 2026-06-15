import { Command } from "@tauri-apps/plugin-shell";
import { logger } from "../utils/logger";
import { z } from "zod";

export interface TestResult {
  file: string;
  name: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
}

export interface TestRunSummary {
  framework: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestResult[];
  rawOutput: string;
}

const FRAMEWORK_DETECTORS = [
  { name: "vitest", file: "vitest.config.ts", cmd: "npx vitest run --reporter=json" },
  { name: "jest", file: "jest.config.js", cmd: "npx jest --json" },
  { name: "mocha", file: ".mocharc.js", cmd: "npx mocha --reporter json" },
  { name: "playwright", file: "playwright.config.ts", cmd: "npx playwright test --reporter=json" },
];

export class TestRunnerService {
  private cwd = "";

  setCwd(path: string): void {
    this.cwd = path;
  }

  async detectFramework(rootPath: string): Promise<string | null> {
    for (const fw of FRAMEWORK_DETECTORS) {
      try {
        const result = await Command.create("test", ["-f", fw.file], { cwd: rootPath }).execute();
        if (result.code === 0) return fw.name;
      } catch {
        try {
          const result = await Command.create("node", ["-e", `require('fs').accessSync('${fw.file}')`], { cwd: rootPath }).execute();
          if (result.code === 0) return fw.name;
        } catch {}
      }
    }
    if (await this.hasTestFiles(rootPath)) return "generic";
    return null;
  }

  private async hasTestFiles(rootPath: string): Promise<boolean> {
    try {
      const result = await Command.create("find", [".", "-name", "*.test.ts", "-o", "-name", "*.spec.ts"], { cwd: rootPath }).execute();
      return result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async runTests(rootPath: string, framework?: string): Promise<TestRunSummary> {
    this.cwd = rootPath;
    const fw = framework ?? (await this.detectFramework(rootPath)) ?? "vitest";
    const cmd = FRAMEWORK_DETECTORS.find((d) => d.name === fw)?.cmd ?? `${fw} --json`;

    try {
      const startTime = Date.now();
      const result = await Command.create("npx", cmd.split(" ").slice(1), { cwd: rootPath }).execute();
      const durationMs = Date.now() - startTime;

      const parsed = this.parseOutput(fw, result.stdout, result.stderr, durationMs);
      return parsed;
    } catch (err: any) {
      return {
        framework: fw,
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 0,
        results: [{ file: "", name: "Execution error", status: "failed", durationMs: 0, error: err.message }],
        rawOutput: err.message ?? String(err),
      };
    }
  }

  private parseOutput(framework: string, stdout: string, stderr: string, durationMs: number): TestRunSummary {
    const results: TestResult[] = [];
    let total = 0, passed = 0, failed = 0, skipped = 0;
    const rawOutput = [stdout, stderr].filter(Boolean).join("\n");

    if (framework === "vitest") {
      try {
        const zodParsed = z.object({
          testResults: z.array(z.object({
            name: z.string().optional(),
            assertionResults: z.array(z.object({
              status: z.string(),
              fullName: z.string().optional(),
              title: z.string().optional(),
              durationMs: z.number().optional(),
              failureMessages: z.array(z.string()).optional()
            })).optional()
          })).optional()
        }).safeParse(JSON.parse(stdout));
        if (!zodParsed.success) throw new Error("Invalid json");
        const json = zodParsed.data;
        for (const file of json.testResults ?? []) {
          for (const assertion of file.assertionResults ?? []) {
            total++;
            const status = assertion.status === "passed" ? "passed" as const : assertion.status === "failed" ? "failed" as const : "skipped" as const;
            if (status === "passed") passed++;
            else if (status === "failed") failed++;
            else skipped++;
            results.push({
              file: file.name ?? "",
              name: assertion.fullName ?? assertion.title ?? "",
              status,
              durationMs: assertion.durationMs ?? 0,
              error: assertion.failureMessages?.[0],
            });
          }
        }
      } catch {
        const passMatch = stdout.match(/(\d+)\s+passed/);
        const failMatch = stdout.match(/(\d+)\s+failed/);
        passed = passMatch ? Number(passMatch[1]) : 0;
        failed = failMatch ? Number(failMatch[1]) : 0;
        total = passed + failed;
      }
    }

    const logLines = stdout.split("\n").filter((l) => l.includes("PASS") || l.includes("FAIL") || l.includes("✓") || l.includes("✗") || l.includes("×"));
    for (const line of logLines.slice(0, 50)) {
      if (!results.find((r) => r.name === line.trim())) {
        const isFail = line.includes("FAIL") || line.includes("✗") || line.includes("×");
        results.push({
          file: "",
          name: line.trim(),
          status: isFail ? "failed" : "passed",
          durationMs: 0,
        });
        if (isFail) failed++;
        else passed++;
        total++;
      }
    }

    return {
      framework,
      total,
      passed,
      failed,
      skipped,
      durationMs,
      results,
      rawOutput,
    };
  }
}

export async function detectTestFiles(rootPath: string): Promise<string[]> {
  try {
    const result = await Command.create("find", [rootPath, "-name", "*.test.ts", "-o", "-name", "*.spec.ts", "-o", "-name", "*.test.tsx", "-o", "-name", "*.spec.tsx"], { cwd: rootPath }).execute();
    return result.stdout.split("\n").filter(Boolean).map((f) => f.replace(rootPath, "").replace(/^\//, ""));
  } catch {
    return [];
  }
}
