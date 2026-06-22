import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { Terminal } from "xterm";

import { BaseController, type ControllerContext } from "../ui/controller";
import type { TerminalService } from "./terminal.service";
import type { TerminalSession, SplitDirection, SplitPane } from "./terminal.types";
import { SplitManager } from "./split-manager";
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
  private readonly mounted = new Map<string, MountedTerminal>();
  private dataDispose: (() => void) | null = null;
  private exitDispose: (() => void) | null = null;
  private splitManager: SplitManager | null = null;
  private dragState: { sessionId: string; startX: number; startY: number; parentDir: SplitDirection } | null = null;

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
    const sessionIds = this.terminalService.getUserSessions().map((s) => s.id);
    this.splitManager = new SplitManager(sessionIds.length ? sessionIds : [userSession.id]);
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
    this.listen("[data-terminal-split-h]", "click", () => {
      void this.splitActive("horizontal");
    });
    this.listen("[data-terminal-split-v]", "click", () => {
      void this.splitActive("vertical");
    });
    this.listen("[data-terminal-close-split]", "click", (_event, button) => {
      const sessionId = button.dataset.terminalCloseSplit;
      if (sessionId) {
        void this.closeSplitPane(sessionId);
      }
    });
    this.listen("#terminal-agent-interrupt", "click", () => {
      void this.interruptAgent();
    });

    this.context.root.addEventListener("mousemove", this.handleDragMove as EventListener);
    this.context.root.addEventListener("mouseup", this.handleDragEnd as EventListener);
    this.context.root.addEventListener("keydown", this.handleKeydown as EventListener);
  }

  public override destroy(): void {
    this.context.root.removeEventListener("keydown", this.handleKeydown as EventListener);
    this.context.root.removeEventListener("mousemove", this.handleDragMove as EventListener);
    this.context.root.removeEventListener("mouseup", this.handleDragEnd as EventListener);
    this.dataDispose?.();
    this.exitDispose?.();
    this.mounted.forEach(({ terminal }) => terminal.dispose());
    this.mounted.clear();
    this.splitManager?.persist();
    super.destroy();
  }

  public refresh(): void {
    this.render();
  }

  private async createUserTerminal(): Promise<void> {
    const session = await this.terminalService.spawnUserTerminal(this.options.cwdProvider());
    if (this.splitManager) {
      const sessionIds = this.splitManager.getSessionIds();
      const target = sessionIds[sessionIds.length - 1] ?? session.id;
      this.splitManager.splitPane(target, session.id, "horizontal");
    }
    this.render();
  }

  private async splitActive(direction: SplitDirection): Promise<void> {
    const session = await this.terminalService.spawnUserTerminal(this.options.cwdProvider());
    if (this.splitManager) {
      const sessionIds = this.splitManager.getSessionIds();
      const activeEl = this.context.root.querySelector<HTMLElement>(".terminal-split-pane.active");
      const activeSessionId = activeEl?.dataset.sessionId ?? sessionIds[sessionIds.length - 1] ?? session.id;
      this.splitManager.splitPane(activeSessionId, session.id, direction);
    }
    this.render();
  }

  private async closeSplitPane(sessionId: string): Promise<void> {
    const sessions = this.terminalService.getUserSessions();
    if (sessions.length <= 1) return;
    await this.terminalService.sendInterrupt(sessionId).catch(() => undefined);
    this.mounted.get(sessionId)?.terminal.dispose();
    this.mounted.delete(sessionId);
    this.terminalService.closeUserSession(sessionId);
    this.splitManager?.closePane(sessionId);
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
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "\\") {
      event.preventDefault();
      this.focusNextPane();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "5") {
      event.preventDefault();
      void this.splitActive("horizontal");
      return;
    }
    const agentPane = this.context.root.querySelector<HTMLElement>("#terminal-agent-pane");
    if (event.ctrlKey && event.key.toLowerCase() === "c" && agentPane?.contains(document.activeElement)) {
      event.preventDefault();
      void this.interruptAgent();
    }
  };

  private focusNextPane(): void {
    const panes = this.context.root.querySelectorAll<HTMLElement>(".terminal-split-pane.active");
    const paneArray = Array.from(panes);
    if (!paneArray.length) return;
    const currentIndex = paneArray.findIndex((p) => p.contains(document.activeElement));
    const nextIndex = (currentIndex + 1) % paneArray.length;
    const nextPane = paneArray[nextIndex];
    if (nextPane) {
      const mount = nextPane.querySelector<HTMLElement>(".terminal-mount");
      if (mount) {
        mount.focus({ preventScroll: true });
      }
    }
  }

  private handleDragStart = (event: MouseEvent, sessionId: string, direction: SplitDirection): void => {
    event.preventDefault();
    this.dragState = {
      sessionId,
      startX: event.clientX,
      startY: event.clientY,
      parentDir: direction,
    };
    const handle = event.target as HTMLElement;
    handle.classList.add("terminal-drag-active");
  };

  private handleDragMove = (event: MouseEvent): void => {
    if (!this.dragState) return;
    const delta = this.dragState.parentDir === "horizontal"
      ? (event.clientX - this.dragState.startX) / (this.context.root.querySelector("#terminal-user-mount")?.clientWidth ?? 1)
      : (event.clientY - this.dragState.startY) / (this.context.root.querySelector("#terminal-user-mount")?.clientHeight ?? 1);
    if (Math.abs(delta) > 0.02) {
      this.splitManager?.resizePane(this.dragState.sessionId, delta);
      this.render();
      this.dragState.startX = event.clientX;
      this.dragState.startY = event.clientY;
    }
  };

  private handleDragEnd = (_event: MouseEvent): void => {
    if (this.dragState) {
      const handle = this.context.root.querySelector(".terminal-drag-active");
      handle?.classList.remove("terminal-drag-active");
      this.dragState = null;
    }
  };

  private render(): void {
    const root = this.context.root.querySelector<HTMLElement>("#terminal-panel-root");
    if (!root) return;
    root.classList.toggle("is-open", this.isOpen);
    this.context.root.querySelector("#terminal-toggle-button")?.classList.toggle("active", this.isOpen);
    const panel = root as unknown as { isOpen: boolean; splitContent: string; agentSession: TerminalSession | null };
    panel.isOpen = this.isOpen;
    if (this.isOpen) {
      panel.splitContent = this.renderSplitContent();
      panel.agentSession = this.terminalService.getAgentSession() ?? null;
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

  private renderSplitContent(): string {
    const userSessions = this.terminalService.getUserSessions();
    return this.splitManager
      ? this.renderSplitPane(this.splitManager.getLayout().root, userSessions)
      : "";
  }

  private renderSplitPane(pane: SplitPane, sessions: TerminalSession[]): string {
    if (pane.kind === "leaf") {
      const session = sessions.find((s) => s.id === pane.sessionId);
      if (!session) return "";
      return `
        <div class="terminal-split-pane active" data-session-id="${session.id}" style="flex: ${pane.size};">
          <div class="terminal-split-pane-header">
            <span class="terminal-split-title">${session.title}</span>
            <div class="terminal-split-pane-actions">
              <button data-terminal-split-h data-split-from="${session.id}" type="button" title="Split horizontal" class="terminal-split-btn">⬌</button>
              <button data-terminal-split-v data-split-from="${session.id}" type="button" title="Split vertical" class="terminal-split-btn">⬍</button>
              <button data-terminal-close-split="${session.id}" type="button" title="Close" class="terminal-split-btn terminal-split-btn-close">x</button>
            </div>
          </div>
          <div class="terminal-mount" data-terminal-session="${session.id}" tabindex="-1"></div>
        </div>
      `;
    }
    if (pane.kind === "split") {
      const flexDirection = pane.direction === "horizontal" ? "row" : "column";
      const children = pane.children.map((child, index) => {
        const rendered = this.renderSplitPane(child, sessions);
        const isLast = index === pane.children.length - 1;
        const gutterDir = pane.direction === "horizontal" ? "vertical" : "horizontal";
        return rendered + (isLast ? "" : `<div class="terminal-gutter terminal-gutter--${gutterDir}" data-gutter-dir="${pane.direction}"></div>`);
      }).join("");
      return `<div class="terminal-split-pane split" style="flex: ${pane.size}; display: flex; flex-direction: ${flexDirection}; min-height: 0; min-width: 0;">${children}</div>`;
    }
    return "";
  }

  private mountVisibleTerminals(): void {
    const mounts = this.context.root.querySelectorAll<HTMLElement>(".terminal-mount[data-terminal-session]");
    mounts.forEach((mount) => {
      const sessionId = mount.dataset.terminalSession;
      const session = this.terminalService.getSessions().find((candidate) => candidate.id === sessionId);
      if (!session || !sessionId) return;
      const mounted = this.ensureMounted(session);
      const isFirstMount = !mounted.terminal.element;
      if (!mounted.terminal.element || !mount.contains(mounted.terminal.element)) {
        mount.replaceChildren();
        mounted.terminal.open(mount);
        if (isFirstMount) {
          mounted.terminal.write(session.scrollback.join("\r\n"));
        }
      }
      mounted.fit.fit();
    });

    this.context.root.querySelectorAll<HTMLElement>(".terminal-gutter").forEach((gutter) => {
      gutter.addEventListener("mousedown", (event: MouseEvent) => {
        const dir = gutter.dataset.gutterDir;
        if (!dir) return;
        const sibling = gutter.previousElementSibling as HTMLElement | null;
        if (!sibling) return;
        const sessionId = sibling.dataset.sessionId;
        if (sessionId) {
          this.handleDragStart(event, sessionId, dir as SplitDirection);
        }
      });
    });
  }

  private ensureMounted(session: TerminalSession): MountedTerminal {
    const existing = this.mounted.get(session.id);
    if (existing) return existing;
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
