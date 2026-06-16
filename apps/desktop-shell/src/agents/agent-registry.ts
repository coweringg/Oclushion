import type { AgentDefinition, AgentRole } from "./types";

export const agentDefinitions: AgentDefinition[] = [
  {
    id: "agent-architect",
    role: "architect",
    name: "Architect Agent",
    description: "Plans technical work and assigns safe implementation zones.",
    model: "claude-opus-4-8",
    permissions: ["read", "propose"],
    allowedPaths: ["docs/*", "secrets/**", "**/migrations/**"],
    systemPrompt:
      "You are a Senior Software Architect. Produce a precise implementation plan, file list, risks and sequencing. Do not write implementation code.",
  },
  {
    id: "agent-builder",
    role: "builder",
    name: "Builder Agent",
    description: "Implements production TypeScript changes as Safe Diff proposals.",
    model: "claude-sonnet-4-6",
    permissions: ["read", "propose"],
    allowedPaths: ["apps/*", "migrations/**", "**/auth/**", "**/billing/**"],
    systemPrompt:
      "You are a Senior Fullstack Builder. Generate complete, production-ready code proposals only. Strict TypeScript, ESM imports, no broad any.",
  },
  {
    id: "agent-reviewer",
    role: "reviewer",
    name: "Reviewer Agent",
    description: "Reviews implementation quality and proposes corrections.",
    model: "gpt-5.5",
    permissions: ["read", "propose"],
    allowedPaths: ["apps/*"],
    forbiddenPaths: [],
    systemPrompt:
      "You are a Chief Security Officer. Find SQL injection, XSS, auth bypasses, secret leakage, unsafe dependencies and PII exposure. Mark blockers clearly.",
  },
  {
    id: "agent-security",
    role: "security",
    name: "Security Agent",
    description: "Audits code for security vulnerabilities, secret leakage, and compliance.",
    model: "gpt-5.5",
    permissions: ["read", "propose"],
    allowedPaths: ["apps/*", "packages/*", "secrets/**", "**/auth/**", "**/security/**"],
    forbiddenPaths: [],
    systemPrompt:
      "You are a Security Engineer. Audit all code changes for SQL injection, XSS, path traversal, auth bypasses, hardcoded secrets, unsafe deserialization, and dependency vulnerabilities. Flag every issue with severity and CVE references where applicable.",
  },
  {
    id: "agent-qa",
    role: "qa",
    name: "Visual QA Agent",
    description: "Executes multimodal tests using a Headless Browser and Computer Vision.",
    model: "gemini-1.5-pro-vision",
    permissions: ["read", "propose"],
    allowedPaths: ["***.test.ts", "**/*.spec.ts", "apps/**/test/**", "packages/**/test/**"],
    forbiddenPaths: ["*.env", ".env*"],
    systemPrompt:
      "You are a Visual QA Engineer. You do not just write tests, you physically interact with the UI via Headless Browser. Validate visual overlaps, interactions, and record a session as proof of life.",
  },
  {
    id: "agent-docs",
    role: "docs",
    name: "Docs Agent",
    description: "Updates technical docs and usage notes.",
    model: "gpt-5.4-mini",
    permissions: ["read", "propose"],
    allowedPaths: ["***.md"],
    forbiddenPaths: ["*.env", ".env*"],
    systemPrompt:
      "You are a technical writer. Keep documentation synchronized with real code. Be concise and operational.",
  },
];

export class AgentRegistry {
  private customAgents: AgentDefinition[] = [];

  public list(): AgentDefinition[] {
    return [...agentDefinitions, ...this.customAgents];
  }

  public get(role: AgentRole): AgentDefinition {
    const agent = [...agentDefinitions, ...this.customAgents].find((definition) => definition.role === role);
    if (!agent) {
      throw new Error(`Unknown agent role: ${role}`);
    }
    return agent;
  }

  public getById(id: string): AgentDefinition | undefined {
    return [...agentDefinitions, ...this.customAgents].find((a) => a.id === id);
  }

  public register(agent: AgentDefinition): void {
    const idx = this.customAgents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) {
      this.customAgents[idx] = agent;
    } else {
      this.customAgents.push(agent);
    }
  }

  public remove(id: string): boolean {
    const idx = this.customAgents.findIndex((a) => a.id === id);
    if (idx >= 0) {
      this.customAgents.splice(idx, 1);
      return true;
    }
    return false;
  }

  public loadFromYaml(yamlContent: string): number {
    const { parseAgentYaml } = require("./agent-config.service");
    const agents = parseAgentYaml(yamlContent);
    let count = 0;
    for (const agent of agents) {
      this.register(agent);
      count++;
    }
    return count;
  }
}
