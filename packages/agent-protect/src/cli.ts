#!/usr/bin/env node
import {
  applySession,
  checkNetworkAccess,
  createProtectedWorkspace,
  diffSession,
  mediateToolInvocation,
  readAgentAuditEvents,
  runMediatedCommand,
  summarizeSession,
} from "./index.js";

async function main() {
  const [, , scope, command, ...args] = process.argv;
  if (scope !== "agent" || !command) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === "start") {
    const project = flag(args, "--project") ?? process.cwd();
    const manifest = await createProtectedWorkspace({ projectPath: project });
    process.stdout.write(
      JSON.stringify(
        {
          sessionId: manifest.id,
          workspacePath: manifest.workspacePath,
          copied: manifest.files.filter((file) => file.status === "copied").length,
          sanitized: manifest.files.filter((file) => file.status === "sanitized").length,
          blocked: manifest.files.filter((file) => file.status === "blocked").length,
          tokens: manifest.mappings.length,
        },
        null,
        2,
      ),
    );
    process.stdout.write("\n");
    return;
  }

  const sessionId = flag(args, "--session");
  if (!sessionId) {
    throw new Error(`sano-agent agent ${command} requires --session <id>.`);
  }

  if (command === "status") {
    process.stdout.write(`${JSON.stringify(await summarizeSession(sessionId), null, 2)}\n`);
    return;
  }
  if (command === "diff") {
    process.stdout.write(`${JSON.stringify(await diffSession(sessionId), null, 2)}\n`);
    return;
  }
  if (command === "apply") {
    process.stdout.write(`${JSON.stringify(await applySession(sessionId), null, 2)}\n`);
    return;
  }
  if (command === "exec") {
    const separator = args.indexOf("--");
    const commandArgs = separator >= 0 ? args.slice(separator + 1) : [];
    const executable = commandArgs[0];
    if (!executable) {
      throw new Error("sano-agent agent exec requires -- <command> [args...]");
    }
    const result = await runMediatedCommand({
      sessionId,
      command: executable,
      args: commandArgs.slice(1),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.decision.effect !== "ALLOW" || (result.exitCode ?? 1) !== 0) {
      process.exitCode = result.exitCode ?? 2;
    }
    return;
  }
  if (command === "network-check") {
    const target = flag(args, "--target");
    if (!target) {
      throw new Error("sano-agent agent network-check requires --target <url-or-host>.");
    }
    process.stdout.write(
      `${JSON.stringify(await checkNetworkAccess({ sessionId, target }), null, 2)}\n`,
    );
    return;
  }
  if (command === "tool") {
    const toolName = flag(args, "--name");
    if (!toolName) {
      throw new Error("sano-agent agent tool requires --name <tool-name>.");
    }
    process.stdout.write(
      `${JSON.stringify(await mediateToolInvocation({ sessionId, toolName }), null, 2)}\n`,
    );
    return;
  }
  if (command === "audit") {
    const events = (await readAgentAuditEvents()).filter((event) => event.sessionId === sessionId);
    process.stdout.write(`${JSON.stringify(events, null, 2)}\n`);
    return;
  }

  usage();
  process.exitCode = 1;
}

function flag(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  sano-agent agent start --project <path>",
      "  sano-agent agent status --session <id>",
      "  sano-agent agent diff --session <id>",
      "  sano-agent agent apply --session <id>",
      "  sano-agent agent exec --session <id> -- <command> [args...]",
      "  sano-agent agent network-check --session <id> --target <url-or-host>",
      "  sano-agent agent tool --session <id> --name <tool-name>",
      "  sano-agent agent audit --session <id>",
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
