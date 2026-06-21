import { CommandPaletteRenderer, type CommandItem, type PaletteMode } from "./renderers/command-palette.renderer";
import { CommandRegistry, type CommandDefinition } from "../commands/command-registry";
import type { VoiceCaptureService } from "../voice/voice-capture.service";
import type { IntentRouter } from "../agents/intent-router";
import type { FileSearchService } from "../editor/file-search.service";
import { showToast } from "./toast";

export class CommandPaletteController {
  private static instance: CommandPaletteController | null = null;

  static getInstance(): CommandPaletteController | null {
    return CommandPaletteController.instance;
  }

  private readonly renderer = new CommandPaletteRenderer();
  public readonly registry: CommandRegistry;
  private isOpen = false;
  private isRecording = false;
  private mode: PaletteMode = "commands";
  private selectedIndex = 0;
  private currentQuery = "";
  private currentResults: CommandItem[] = [];
  private toggleListenerCleanup: (() => void) | null = null;

  public constructor(
    private readonly voiceCapture?: VoiceCaptureService,
    private readonly intentRouter?: IntentRouter,
    private readonly fileSearch?: FileSearchService,
  ) {
    this.registry = new CommandRegistry();
    this.registerBuiltins();
  }

  public getRegistry(): CommandRegistry {
    return this.registry;
  }

  public mount(root: HTMLElement): void {
    const mount = document.createElement("div");
    mount.id = "command-palette-root";
    root.appendChild(mount);
    this.renderer.render("command-palette-overlay", "commands");
    this.attachEvents();
    CommandPaletteController.instance = this;
    this.attachToggleListener();
  }

  private attachToggleListener(): void {
    const handler = () => {
      if (this.isOpen) {
        this.close();
      } else {
        this.open("commands");
      }
    };
    window.addEventListener("ocl-command-palette-toggle", handler);
    this.toggleListenerCleanup = () => window.removeEventListener("ocl-command-palette-toggle", handler);
  }

  private registerBuiltins(): void {
    this.registry.registerAll([
      { id: "toggle-terminal", icon: ">_", label: "Toggle Terminal", shortcut: "Ctrl+`", category: "Tools", handler: () => this.executePaletteCommand("toggle-terminal") },
      { id: "toggle-god-mode", icon: "🧠", label: "Toggle God Mode", shortcut: "Ctrl+Shift+A", category: "Dev", handler: () => this.executePaletteCommand("toggle-god-mode") },
      { id: "open-settings", icon: "⚙️", label: "Open Settings", shortcut: "Ctrl+,", category: "System", handler: () => this.executePaletteCommand("open-settings") },
      { id: "open-marketplace", icon: "🧩", label: "Open Marketplace", category: "Tools", handler: () => this.executePaletteCommand("open-marketplace") },
      { id: "open-audit", icon: "📋", label: "Open Audit Log", category: "System", handler: () => this.executePaletteCommand("open-audit") },
      { id: "git-commit", icon: "📦", label: "Git Commit", category: "Git", handler: () => this.executePaletteCommand("git-commit") },
      { id: "toggle-agi", icon: "🤖", label: "Toggle AGI Mode", category: "Dev", handler: () => this.executePaletteCommand("toggle-agi") },
      { id: "run-tests", icon: "🧪", label: "Run Tests", category: "Dev", handler: () => this.executePaletteCommand("run-tests") },
      { id: "search-project", icon: "🔍", label: "Search in Project", shortcut: "Ctrl+Shift+F", category: "Search", handler: () => this.executePaletteCommand("search-project") },
      { id: "new-chat", icon: "💬", label: "New Chat", shortcut: "Ctrl+L", category: "Chat", handler: () => this.executePaletteCommand("new-chat") },
    ]);
  }

  private attachEvents(): void {
    this.attachKeyboardShortcuts();
    this.attachClickEvents();
  }

  private attachKeyboardShortcuts(): void {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.toggle("commands");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        this.toggle("commands");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        this.toggle("files");
        return;
      }
      if (!this.isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.navigate(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.navigate(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        this.executeSelected();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const input = document.getElementById("command-palette-input") as HTMLInputElement;
        if (input) {
          this.cycleMode(input);
        }
      }
    });
  }

  private attachClickEvents(): void {
    document.addEventListener("click", (e) => {
      const overlay = document.getElementById("command-palette-overlay");
      if (this.isOpen && e.target === overlay) {
        this.close();
      }

      const item = (e.target as HTMLElement).closest(".ocl-command-item");
      if (item && this.isOpen) {
        const commandId = item.getAttribute("data-command-id");
        if (commandId) {
          this.executeCommand(commandId);
          this.close();
        }
      }
    });

    document.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === "command-palette-input") {
        this.selectedIndex = 0;
        this.currentQuery = target.value;
        this.currentMode = (target.dataset.paletteMode as PaletteMode) ?? "commands";
        this.searchAndRender(this.currentQuery, this.currentMode);
      }
    });
  }

  private currentMode: PaletteMode = "commands";

  private toggle(mode?: PaletteMode): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(mode);
    }
  }

  private open(mode?: PaletteMode): void {
    this.isOpen = true;
    this.mode = mode ?? this.mode;
    this.currentMode = this.mode;
    this.selectedIndex = 0;
    this.currentQuery = "";

    const overlay = document.getElementById("command-palette-overlay");
    const input = document.getElementById("command-palette-input") as HTMLInputElement;
    if (overlay) {
      overlay.classList.add("open");
      overlay.innerHTML = this.renderer.render("command-palette-overlay", this.mode);
    }
    if (input) {
      input.value = "";
      input.focus();
    }
    this.searchAndRender("", this.mode);
  }

  private close(): void {
    this.isOpen = false;
    const overlay = document.getElementById("command-palette-overlay");
    if (overlay) overlay.classList.remove("open");
  }

  private navigate(direction: 1 | -1): void {
    const total = this.currentResults.length;
    if (total === 0) return;
    this.selectedIndex = (this.selectedIndex + direction + total) % total;
    this.updateSelection();
  }

  private updateSelection(): void {
    const items = document.querySelectorAll(".ocl-command-item");
    items.forEach((el, i) => {
      el.classList.toggle("ocl-command-item--selected", i === this.selectedIndex);
    });
    const selected = items[this.selectedIndex] as HTMLElement | undefined;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  private executeSelected(): void {
    const item = this.currentResults[this.selectedIndex];
    if (item) {
      this.executeCommand(item.id);
      this.close();
    }
  }

  private cycleMode(input: HTMLInputElement): void {
    const val = input.value;
    if (val.startsWith(">")) {
      input.value = val.slice(1).trim();
      this.mode = "files";
    } else if (val.startsWith("@")) {
      input.value = val.slice(1).trim();
      this.mode = "commands";
    } else {
      input.value = "> " + val;
      this.mode = "commands";
    }
    this.currentMode = this.mode;
    input.dataset.paletteMode = this.mode;
    input.focus();
    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);
  }

  private async searchAndRender(query: string, mode: PaletteMode): Promise<void> {
    const results = document.getElementById("command-palette-results");
    if (!results) return;

    let prefix = "";
    let searchQuery = query;

    if (query.startsWith(">")) {
      prefix = ">";
      searchQuery = query.slice(1).trim();
      mode = "commands";
    } else if (query.startsWith("@")) {
      prefix = "@";
      searchQuery = query.slice(1).trim();
      mode = "files";
    }

    let items: CommandItem[];
    if (mode === "files" && this.fileSearch) {
      const files = this.fileSearch.getAllFiles();
      const results = this.registry.searchFiles(searchQuery, files);
      items = results;
    } else {
      const results = this.registry.search(searchQuery);
      if (prefix === ">") {
        items = results;
      } else {
        items = results;
      }
    }

    this.currentResults = items;
    this.selectedIndex = Math.min(this.selectedIndex, items.length - 1);

    results.innerHTML = this.renderer.renderGroupedItems(
      items,
      searchQuery,
      this.selectedIndex,
      prefix,
    );
  }

  private executeCommand(id: string): void {
    const cmd = this.registry.get(id);
    if (cmd) {
      void cmd.handler();
      return;
    }

    if (id.startsWith("file:")) {
      const path = id.slice(5);
      const event = new CustomEvent("ocl-command", {
        detail: { commandId: "open-file", filePath: path },
      });
      document.dispatchEvent(event);
      return;
    }

    const event = new CustomEvent("ocl-command", { detail: { commandId: id } });
    document.dispatchEvent(event);
  }

  private executePaletteCommand(id: string): void {
    const event = new CustomEvent("ocl-command", { detail: { commandId: id } });
    document.dispatchEvent(event);
  }

  private async handleVoiceCommand(): Promise<void> {
    if (!this.voiceCapture || !this.intentRouter) return;

    if (this.isRecording) {
      try {
        const audio = await this.voiceCapture.stopRecording();
        this.isRecording = false;
        showToast({ message: "Procesando voz...", severity: "info" });
        const text = await this.voiceCapture.transcribe(audio);
        const decision = await this.intentRouter.route(text);
        showToast({ message: `Intención: ${decision.intent} — ${decision.actionPayload}`, severity: "success" });
      } catch {
        this.isRecording = false;
        showToast({ message: "Error en Voice Capture", severity: "error" });
      }
    } else {
      try {
        await this.voiceCapture.startRecording();
        this.isRecording = true;
        showToast({ message: "🎤 Grabando... — Vuelve a ejecutar el comando para detener", severity: "info" });
      } catch {
        showToast({ message: "Microfono no disponible", severity: "error" });
      }
    }
  }
}
