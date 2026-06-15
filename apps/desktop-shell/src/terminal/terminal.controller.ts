import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { Terminal } from "xterm";

import { BaseController, type ControllerContext } from "../ui/controller";
import type { TerminalService } from "./terminal.service";
import type { TerminalSession } from "./terminal.types";
import "xterm/css/xterm.css";

export type TerminalControllerOptions = {
  cwdProvider: () => string;
};

type MountedTerminal = {
  terminal: Terminal;
  fit: FitAddon;
};

export class TerminalController extends BaseController {
  private isOpen = false;
  private activeUserSessionId: string | null = null;
  private readonly mounted = new Map<string, MountedTerminal>();
  private dataDispose: (() => void) | null = null;
  private exitDispose: (() => void) | null = null;

  public constructor(
    context: ControllerContext,
    private readonly terminalService: TerminalService,
    private readonly options: TerminalControllerOptions,
  ) {
    super(context);
  }

  public async initialize(): Promise<void> {
    await this.terminalService.getOrCreateAgentTerminal(this.options.cwdProvider());
    const userSession = await this.terminalService.spawnUserTerminal(this.options.cwdProvider());
    this.activeUserSessionId = userSession.id;
    this.render();
  }

  public mount(): void {
    this.dataDispose = this.terminalService.onData((session, data) => {
      this.mounted.get(session.id)?.terminal.write(data);
      this.renderStatusOnly();
    });
    this.exitDispose = this.terminalService.onExit(() => {
      this.renderStatusOnly();
    });

    this.listen("#terminal-toggle-button", "click", () => {
      this.isOpen = !this.isOpen;
      this.render();
    });
    this.listen("#terminal-new-user-button", "click", () => {
      void this.createUserTerminal();
    });
    this.listen("button[data-terminal-user-tab]", "click", (_event, button) => {
      const sessionId = button.dataset.terminalUserTab;
      if (sessionId) {
        this.activeUserSessionId = sessionId;
        this.render();
      }
    });
    this.listen("[data-terminal-close-user]", "click", (event, button) => {
      event.stopPropagation();
      const sessionId = button.dataset.terminalCloseUser;
      if (sessionId) {
        void this.closeUserTerminal(sessionId);
      }
    });
    this.listen("#terminal-agent-interrupt", "click", () => {
      void this.interruptAgent();
    });

    this.context.root.addEventListener("keydown", this.handleKeydown as EventListener);
  }

  public override destroy(): void {
    this.context.root.removeEventListener("keydown", this.handleKeydown as EventListener);
    this.dataDispose?.();
    this.exitDispose?.();
    this.mounted.forEach(({ terminal }) => terminal.dispose());
    this.mounted.clear();
    super.destroy();
  }

  public refresh(): void {
    this.render();
  }

  private async createUserTerminal(): Promise<void> {
    const session = await this.terminalService.spawnUserTerminal(this.options.cwdProvider());
    this.activeUserSessionId = session.id;
    this.render();
  }

  private async closeUserTerminal(sessionId: string): Promise<void> {
    const sessions = this.terminalService.getUserSessions();
    if (sessions.length <= 1) {
      return;
    }
    await this.terminalService.sendInterrupt(sessionId).catch(() => undefined);
    this.mounted.get(sessionId)?.terminal.dispose();
    this.mounted.delete(sessionId);
    this.terminalService.closeUserSession(sessionId);
    if (this.activeUserSessionId === sessionId) {
      this.activeUserSessionId = this.terminalService.getUserSessions()[0]?.id ?? null;
    }
    this.render();
  }

  private async interruptAgent(): Promise<void> {
    const session = this.terminalService.getAgentSession();
    if (session) {
      await this.terminalService.sendInterrupt(session.id);
    }
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === "`") {
      event.preventDefault();
      this.isOpen = !this.isOpen;
      this.render();
      return;
    }
    const agentPane = this.context.root.querySelector<HTMLElement>("#terminal-agent-pane");
    if (event.ctrlKey && event.key.toLowerCase() === "c" && agentPane?.contains(document.activeElement)) {
      event.preventDefault();
      void this.interruptAgent();
    }
  };

  private render(): void {
    const root = this.context.root.querySelector<HTMLElement>("#terminal-panel-root");
    if (!root) {
      return;
    }
    root.innerHTML = this.isOpen ? this.renderOpenPanel() : "";
    root.classList.toggle("is-open", this.isOpen);
    this.context.root.querySelector("#terminal-toggle-button")?.classList.toggle("active", this.isOpen);
    if (this.isOpen) {
      queueMicrotask(() => this.mountVisibleTerminals());
    }
  }

  private renderStatusOnly(): void {
    const agentSession = this.terminalService.getAgentSession();
    const status = this.context.root.querySelector<HTMLElement>("#terminal-agent-status");
    if (status && agentSession) {
      status.textContent = agentSession.isAlive ? "Running" : "Idle";
      status.classList.toggle("running", agentSession.isAlive);
    }
  }

  private renderOpenPanel(): string {
    const agentSession = this.terminalService.getAgentSession();
    const userSessions = this.terminalService.getUserSessions();
    const activeUser = userSessions.find((session) => session.id === this.activeUserSessionId) ?? userSessions[0];
    this.activeUserSessionId = activeUser?.id ?? null;

    return `
      <section class="terminal-panel" aria-label="Integrated terminal">
        <section class="terminal-pane user">
          <header class="terminal-user-tabs">
            <div class="terminal-user-tab-list">
              ${userSessions.map((session) => this.renderUserTab(session)).join("")}
            </div>
            <button id="terminal-new-user-button" type="button" title="Nueva terminal de usuario">+</button>
          </header>
          <div id="terminal-user-mount" class="terminal-mount" data-terminal-session="${activeUser?.id ?? ""}"></div>
        </section>
        <aside id="terminal-agent-pane" class="terminal-pane agent" tabindex="0">
          <header class="terminal-pane-header">
            <div>
              <strong>AGENT TERMINAL</strong>
              <span id="terminal-agent-status" class="${agentSession?.isAlive ? "running" : ""}">
                ${agentSession?.isAlive ? "Running" : "Idle"}
              </span>
            </div>
            <button id="terminal-agent-interrupt" type="button" title="Ctrl+C cancela el proceso actual del agente">Ctrl+C</button>
          </header>
          <div id="terminal-agent-mount" class="terminal-mount readonly" data-terminal-session="${agentSession?.id ?? ""}"></div>
        </aside>
        <footer class="terminal-suggestions" id="terminal-suggestions">
          <span class="suggestions-label">AI:</span>
          <div class="suggestions-list" id="suggestions-list"></div>
          <button id="suggestions-refresh-btn" type="button" title="Get AI suggestions">✨</button>
        </footer>
      </section>
    `;
  }

  private renderUserTab(session: TerminalSession): string {
    const active = session.id === this.activeUserSessionId ? "active" : "";
    return `
      <button class="terminal-user-tab ${active}" type="button" data-terminal-user-tab="${session.id}">
        <span>${session.title}</span>
        <i class="${session.isAlive ? "alive" : ""}"></i>
        <b data-terminal-close-user="${session.id}" role="button" aria-label="Cerrar terminal">x</b>
      </button>
    `;
  }

  private mountVisibleTerminals(): void {
    const mounts = this.context.root.querySelectorAll<HTMLElement>(".terminal-mount[data-terminal-session]");
    mounts.forEach((mount) => {
      const sessionId = mount.dataset.terminalSession;
      const session = this.terminalService.getSessions().find((candidate) => candidate.id === sessionId);
      if (!session || !sessionId) {
        return;
      }
      const mounted = this.ensureMounted(session);
      if (!mounted.terminal.element || !mount.contains(mounted.terminal.element)) {
        mount.replaceChildren();
        mounted.terminal.open(mount);
        mounted.terminal.write(session.scrollback.join("\r\n"));
      }
      mounted.fit.fit();
    });
  }

  private ensureMounted(session: TerminalSession): MountedTerminal {
    const existing = this.mounted.get(session.id);
    if (existing) {
      return existing;
    }
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: session.owner === "user",
      disableStdin: session.owner === "agent",
      fontFamily: "JetBrains Mono, Consolas, monospace",
      fontSize: 12,
      theme: {
        background: "#07101c",
        foreground: "#d8deea",
        cursor: "#9d6bff",
        selectionBackground: "#7b4dff55",
        black: "#07101c",
        blue: "#5f63ff",
        cyan: "#22d7ff",
        green: "#45e5a2",
        magenta: "#9d6bff",
        red: "#ff5b66",
        white: "#f4f7fb",
        yellow: "#f6c85f",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new Unicode11Addon());
    terminal.unicode.activeVersion = "11";
    if (session.owner === "user") {
      terminal.onData((data) => {
        void this.terminalService.writeToUserTerminal(session.id, data);
      });
    }
    const mounted = { terminal, fit };
    this.mounted.set(session.id, mounted);
    return mounted;
  }
}
