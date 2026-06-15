export type CommandCategory = "safe" | "build" | "install" | "network" | "destructive" | "shell_escape";
export type CommandRiskLevel = "low" | "medium" | "high" | "blocked";

export type CommandPolicyDecision = {
  category: CommandCategory;
  riskLevel: CommandRiskLevel;
  requiresApproval: boolean;
  reason: string;
  suggestedAlternative?: string;
};

export type CommandRule = {
  name: string;
  priority: number;
  evaluate(normalizedCommand: string, args: string[], full: string): CommandPolicyDecision | null;
};

const safeCommands = new Set([
  "git",
  "ls",
  "dir",
  "pwd",
  "cat",
  "echo",
  "node",
  "pnpm",
  "npm",
  "npx",
  "cargo",
  "rustc",
  "python",
  "python3",
  "pip",
]);

const blockedPatterns = [
  /\brm\s+-rf\s+(?:\/|\*|~)/iu,
  /\bRemove-Item\b.+\b-Recurse\b.+\b-Force\b/iu,
  /\bdrop\s+database\b/iu,
  /\bformat\s+[a-z]:/iu,
  /\bshutdown\b/iu,
  /\breboot\b/iu,
];

const shellEscapePatterns = [
  /`[^`]+`/u,
  /\$\([^)]+\)/u,
  /[;&|]{1,2}\s*(?:curl|wget).*\|\s*(?:sh|bash|powershell)/iu,
  /;\s*rm\b/iu,
  /\|\s*(?:sh|bash|powershell)\b/iu,
];

const rules: CommandRule[] = [
  {
    name: "shell-escape",
    priority: 100,
    evaluate: (_cmd, _args, full) =>
      shellEscapePatterns.some((p) => p.test(full))
        ? {
            category: "shell_escape",
            riskLevel: "blocked",
            requiresApproval: false,
            reason: "Command contains shell escape or pipe-to-shell patterns.",
          }
        : null,
  },
  {
    name: "blocked-destructive",
    priority: 90,
    evaluate: (_cmd, _args, full) =>
      blockedPatterns.some((p) => p.test(full))
        ? {
            category: "destructive",
            riskLevel: "blocked",
            requiresApproval: false,
            reason: "Command matches a permanently blocked destructive pattern.",
          }
        : null,
  },
  {
    name: "install-command",
    priority: 80,
    evaluate: (normalizedCommand, args) =>
      /\binstall\b/iu.test(normalizedCommand) || args.includes("install")
        ? {
            category: "install",
            riskLevel: "high",
            requiresApproval: true,
            reason: "Package install can execute arbitrary lifecycle scripts.",
            suggestedAlternative: "Use --ignore-scripts flag for package installs.",
          }
        : null,
  },
  {
    name: "network-command",
    priority: 70,
    evaluate: (normalizedCommand) =>
      ["curl", "wget", "fetch"].includes(normalizedCommand.toLowerCase())
        ? {
            category: "network",
            riskLevel: "high",
            requiresApproval: true,
            reason: "Network commands can download or execute remote code.",
          }
        : null,
  },
  {
    name: "build-command",
    priority: 60,
    evaluate: (_cmd, args) =>
      args.some((arg) => arg === "build" || arg === "run" || arg === "test")
        ? {
            category: "build",
            riskLevel: "medium",
            requiresApproval: false,
            reason: "Build commands run project scripts.",
          }
        : null,
  },
  {
    name: "safe-command",
    priority: 50,
    evaluate: (normalizedCommand, args) =>
      safeCommands.has(normalizedCommand.toLowerCase()) && args.every((arg) => !/[|;&`]/u.test(arg))
        ? {
            category: "safe",
            riskLevel: "low",
            requiresApproval: false,
            reason: "Known safe command.",
          }
        : null,
  },
];

export function registerRule(rule: CommandRule): void {
  rules.push(rule);
  rules.sort((a, b) => b.priority - a.priority);
}

export function evaluateCommand(command: string, args: string[]): CommandPolicyDecision {
  const normalizedCommand = command.trim();
  const full = [normalizedCommand, ...args].join(" ");

  for (const rule of rules) {
    const decision = rule.evaluate(normalizedCommand, args, full);
    if (decision) {
      return decision;
    }
  }

  return {
    category: "build",
    riskLevel: "medium",
    requiresApproval: true,
    reason: "Unknown command; approval required.",
  };
}

export function hardenInstallCommand(command: string, args: string[]): string[] {
  const normalized = command.toLowerCase();
  if ((normalized === "pnpm" || normalized === "npm" || normalized === "yarn") && args.includes("install")) {
    return args.includes("--ignore-scripts") ? args : [...args, "--ignore-scripts"];
  }
  return [...args];
}
