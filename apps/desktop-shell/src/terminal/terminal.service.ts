import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { SanoShield } from "../sano-shield.service";
import type { PermissionManager } from "../security/permission.manager";
import type { TerminalDataEvent, TerminalExitEvent, TerminalSession } from "./terminal.types";
import { logger } from "../utils/logger";

type TerminalListener = (session: TerminalSession, data: string) => void;
type TerminalExitListener = (session: TerminalSession, code: number | null) => void;

type SpawnPayload = {
  sessionId?: string;
  session_id?: string;
  pid?: number;
};

export type TerminalBridge = {
  spawnUser(cwd?: string): Promise<SpawnPayload>;
  spawnAgent(cwd?: string): Promise<SpawnPayload>;
  runAgentCommand(sessionId: string, command: string, args: string[], cwd?: string): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  kill(sessionId: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  onData(listener: (event: TerminalDataEvent) => void): Promise<() => void>;
  onExit(listener: (event: TerminalExitEvent) => void): Promise<() => void>;
};

export class TerminalService {
  private readonly sessions = new Map<string, TerminalSession>();
  private readonly dataListeners = new Set<TerminalListener>();
  private readonly exitListeners = new Set<TerminalExitListener>();
  private readonly disposers: Array<() => void> = [];
  private agentSessionId: string | null = null;

  public constructor(
    private readonly shield: SanoShield,
    private readonly permissions?: PermissionManager,
    bridge?: TerminalBridge,
  ) {
    if (bridge) {
      this.bridge = bridge;
    } else if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      this.bridge = createTauriTerminalBridge();
    } else {
      logger.warn("Terminal", "Terminal unavailable — not in Tauri context");
      this.bridge = createNoopTerminalBridge();
    }
  }

  private readonly bridge: TerminalBridge;

  public async start(): Promise<void> {
    this.disposers.push(await this.bridge.onData((event) => this.ingestData(event)));
    this.disposers.push(await this.bridge.onExit((event) => this.ingestExit(event)));
  }

  public destroy(): void {
    while (this.disposers.length) {
      this.disposers.pop()?.();
    }
    this.dataListeners.clear();
    this.exitListeners.clear();
  }

  public async spawnUserTerminal(cwd = defaultCwd()): Promise<TerminalSession> {
    const payload = await this.bridge.spawnUser(cwd);
    const index = this.getUserSessions().length + 1;
    const session = this.createSession({
      id: payload.sessionId ?? payload.session_id ?? "",
      owner: "user",
      pid: payload.pid,
      title: `Terminal ${index}`,
      cwd,
      isAlive: true,
    });
    return session;
  }

  public async getOrCreateAgentTerminal(cwd = defaultCwd()): Promise<TerminalSession> {
    if (this.agentSessionId) {
      const existing = this.sessions.get(this.agentSessionId);
      if (existing) {
        return existing;
      }
    }
    const payload = await this.bridge.spawnAgent(cwd);
    const session = this.createSession({
      id: payload.sessionId ?? payload.session_id ?? "",
      owner: "agent",
      pid: payload.pid,
      title: "Agente IA",
      cwd,
      isAlive: false,
    });
    this.agentSessionId = session.id;
    return session;
  }

  public async writeToUserTerminal(sessionId: string, data: string): Promise<void> {
    const session = this.requireSession(sessionId);
    if (session.owner !== "user") {
      throw new Error("La terminal del Agente IA es read-only para el usuario.");
    }
    await this.bridge.write(sessionId, data);
  }

  public async sendInterrupt(sessionId: string): Promise<void> {
    await this.bridge.kill(sessionId);
  }

  public async writeCommandEcho(sessionId: string, command: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const timestamp = new Date().toLocaleTimeString();
    this.writeServiceData(session, `\r\n[90m[${timestamp}][0m [36m$ ${command}[0m\r\n`);
  }

  public async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    await this.bridge.resize(sessionId, cols, rows);
  }

  public async runAgentCommand(
    command: string,
    args: string[] = [],
    cwd = defaultCwd(),
    options: { requirePromptOverride?: boolean } = {},
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    const printable = [command, ...args].join(" ");
    const decision = await this.permissions?.shouldPromptUser("terminal_command", printable);
    if (decision?.shouldPrompt && !options.requirePromptOverride) {
      throw new Error(`Command requires explicit confirmation: ${decision.reason}`);
    }
    const session = await this.getOrCreateAgentTerminal(cwd);
    session.isAlive = true;
    const startLine = session.scrollback.length;
    const completion = new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
      const dispose = this.onExit((exited, code) => {
        if (exited.id === session.id) {
          dispose();
          const output = session.scrollback.slice(startLine).join("\n");
          resolve({ exitCode: code, stdout: output, stderr: "" });
        }
      });
    });
    await this.bridge.runAgentCommand(session.id, command, args, cwd);
    return completion;
  }

  public getAgentScrollback(lastNLines = 200): string[] {
    const session = this.agentSessionId ? this.sessions.get(this.agentSessionId) : null;
    if (!session) {
      return [];
    }
    return session.scrollback.slice(-lastNLines);
  }

  public getUserSessions(): TerminalSession[] {
    return [...this.sessions.values()].filter((session) => session.owner === "user");
  }

  public getSessions(): TerminalSession[] {
    return [...this.sessions.values()];
  }

  public getAgentSession(): TerminalSession | null {
    return this.agentSessionId ? this.sessions.get(this.agentSessionId) ?? null : null;
  }

  public closeUserSession(sessionId: string): void {
    const session = this.requireSession(sessionId);
    if (session.owner !== "user") {
      throw new Error("La terminal del Agente IA no se puede cerrar.");
    }
    this.sessions.delete(sessionId);
  }

  public onData(listener: TerminalListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  public onExit(listener: TerminalExitListener): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  private createSession(input: Omit<TerminalSession, "scrollback" | "createdAt">): TerminalSession {
    const session: TerminalSession = {
      ...input,
      scrollback: [],
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  private requireSession(sessionId: string): TerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }
    return session;
  }

  private ingestData(event: TerminalDataEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) {
      return;
    }
    const sanitized = this.shield.sanitize(event.data).sanitizedText;
    this.appendToScrollback(session, sanitized);
    for (const listener of this.dataListeners) {
      listener(session, sanitized);
    }
  }

  private ingestExit(event: TerminalExitEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) {
      return;
    }
    session.isAlive = false;
    this.writeServiceData(session, `\r\n[process exited with code ${event.code ?? "unknown"}]\r\n`);
    for (const listener of this.exitListeners) {
      listener(session, event.code);
    }
  }

  private writeServiceData(session: TerminalSession, data: string): void {
    this.appendToScrollback(session, data);
    for (const listener of this.dataListeners) {
      listener(session, data);
    }
  }

  private appendToScrollback(session: TerminalSession, data: string): void {
    const lines = data.split(/\r?\n/u);
    session.scrollback.push(...lines);
    if (session.scrollback.length > 2_000) {
      session.scrollback.splice(0, session.scrollback.length - 2_000);
    }
  }
}

export function createTauriTerminalBridge(): TerminalBridge {
  return {
    spawnUser: (cwd) => invoke<SpawnPayload>("terminal_spawn_user", { cwd }),
    spawnAgent: (cwd) => invoke<SpawnPayload>("terminal_spawn_agent", { cwd }),
    runAgentCommand: (sessionId, command, args, cwd) =>
      invoke<void>("terminal_run_agent_command", {
        sessionId,
        command,
        args,
        cwd,
      }),
    write: (sessionId, data) => invoke<void>("terminal_write", { sessionId, data }),
    kill: (sessionId) => invoke<void>("terminal_kill", { sessionId }),
    resize: (sessionId, cols, rows) => invoke<void>("terminal_resize", { sessionId, cols, rows }),
    onData: async (listener) => listen<TerminalDataEvent>("terminal:data", (event) => listener(event.payload)),
    onExit: async (listener) => listen<TerminalExitEvent>("terminal:exit", (event) => listener(event.payload)),
  };
}

function createNoopTerminalBridge(): TerminalBridge {
  return {
    spawnUser: async () => ({}),
    spawnAgent: async () => ({}),
    runAgentCommand: async () => undefined,
    write: async () => undefined,
    kill: async () => undefined,
    resize: async () => undefined,
    onData: async () => () => undefined,
    onExit: async () => () => undefined,
  };
}

function defaultCwd(): string {
  return "";
}
