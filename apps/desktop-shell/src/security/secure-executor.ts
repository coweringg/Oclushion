import { Command } from "@tauri-apps/plugin-shell";

import { SanoShield } from "../sano-shield.service";
import { PermissionManager } from "./permission.manager";
import type { AgentActionType } from "./permission.manager";

export type CommandExecutionResult = {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  autoExecuted: boolean;
  startedAt: string;
  completedAt: string;
  timedOut: boolean;
  truncated: boolean;
};

export type CommandAuditSink = (event: {
  type: "COMMAND_EXECUTED";
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
}) => void;

const DEFAULT_TIMEOUT_MS = 60000;
const MAX_OUTPUT_CHARS = 50000;

export class SecureExecutor {
  public constructor(
    private readonly permissions: PermissionManager,
    private readonly shield: SanoShield,
    private readonly auditSink: CommandAuditSink = () => undefined,
  ) {}

  public async runCommand(input: {
    command: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: number;
    requirePromptOverride?: boolean;
  }): Promise<CommandExecutionResult> {
    const args = input.args ?? [];
    const printable = [input.command, ...args].join(" ");
    const decision = await this.permissions.shouldPromptUser("terminal_command", printable);
    if (decision.shouldPrompt && !input.requirePromptOverride) {
      throw new Error(`Command requires explicit confirmation: ${decision.reason}`);
    }
    const startedAt = new Date().toISOString();
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let completedAt: string;
    let exitCode: number | null = null;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let truncated = false;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Command timed out")), timeoutMs),
      );
      const executionPromise = Command.create(
        input.command, args,
        input.cwd ? { cwd: input.cwd } : undefined,
      ).execute();

      const output = await Promise.race([executionPromise, timeoutPromise]).catch((error) => {
        if (error?.message === "Command timed out") {
          timedOut = true;
          return null;
        }
        throw error;
      });

      completedAt = new Date().toISOString();

      if (output) {
        exitCode = output.code;
        stdout = output.stdout ?? "";
        stderr = output.stderr ?? "";

        if (stdout.length > MAX_OUTPUT_CHARS) {
          stdout = stdout.slice(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
          truncated = true;
        }
        if (stderr.length > MAX_OUTPUT_CHARS) {
          stderr = stderr.slice(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
          truncated = true;
        }
      } else {
        completedAt = startedAt;
      }
    } catch (error) {
      completedAt = new Date().toISOString();
      stderr = error instanceof Error ? error.message : String(error);
    }

    const sanitizedStdout = this.shield.sanitize(stdout).sanitizedText;
    const sanitizedStderr = this.shield.sanitize(stderr).sanitizedText;

    const result: CommandExecutionResult = {
      command: input.command,
      args,
      exitCode,
      stdout: sanitizedStdout,
      stderr: sanitizedStderr,
      autoExecuted: !decision.shouldPrompt,
      startedAt,
      completedAt,
      timedOut,
      truncated,
    };

    this.auditSink({
      type: "COMMAND_EXECUTED",
      summary: `${result.autoExecuted ? "[AUTO_EXECUTED] " : ""}${printable}${timedOut ? " [TIMED_OUT]" : ""}`,
      metadata: {
        command: input.command,
        exitCode: exitCode ?? -1,
        autoExecuted: result.autoExecuted,
        cwd: input.cwd ?? null,
        timedOut,
        truncated,
        stderrLength: stderr.length,
      },
    });

    return result;
  }

  public async shouldPrompt(actionType: AgentActionType, details: string): Promise<boolean> {
    const decision = await this.permissions.shouldPromptUser(actionType, details);
    return decision.shouldPrompt;
  }
}
