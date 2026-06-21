export type ShortcutCategory = "file" | "edit" | "view" | "agent" | "navigation";

export type Shortcut = {
  readonly key: string;
  readonly modifiers: string[];
  readonly action: string;
  readonly description: string;
  readonly category: ShortcutCategory;
};

export type ShortcutHandler = () => void | Promise<void>;

export type KeyboardShortcutEvent =
  | { type: "shortcut:executed"; action: string; key: string }
  | { type: "shortcut:conflict"; action1: string; action2: string; key: string }
  | { type: "shortcut:registered"; action: string }
  | { type: "shortcut:unregistered"; action: string };

export type KeyboardShortcutListener = (event: KeyboardShortcutEvent) => void;

export class KeyboardShortcutsService {
  private shortcuts = new Map<string, Shortcut>();
  private handlers = new Map<string, ShortcutHandler>();
  private listeners = new Set<KeyboardShortcutListener>();

  register(shortcut: Shortcut, handler: ShortcutHandler): void {
    const compositeKey = this.buildCompositeKey(shortcut);
    const existing = this.shortcuts.get(compositeKey);
    if (existing && existing.action !== shortcut.action) {
      this.emit({
        type: "shortcut:conflict",
        action1: existing.action,
        action2: shortcut.action,
        key: compositeKey,
      });
    }

    this.shortcuts.set(compositeKey, shortcut);
    this.handlers.set(compositeKey, handler);
    this.emit({ type: "shortcut:registered", action: shortcut.action });
  }

  unregister(action: string): void {
    for (const [key, shortcut] of this.shortcuts) {
      if (shortcut.action === action) {
        this.shortcuts.delete(key);
        this.handlers.delete(key);
        this.emit({ type: "shortcut:unregistered", action });
        break;
      }
    }
  }

  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getByCategory(category: ShortcutCategory): Shortcut[] {
    return this.getAll().filter((s) => s.category === category);
  }

  getByAction(action: string): Shortcut | undefined {
    return this.getAll().find((s) => s.action === action);
  }

  getDisplayKey(action: string): string {
    const shortcut = this.getByAction(action);
    if (!shortcut) return "";
    return this.formatKey(shortcut);
  }

  formatKey(shortcut: Shortcut): string {
    const isMac = navigator.userAgent.includes("Mac");
    const modKey = isMac ? "Cmd" : "Ctrl";
    const modifiers = shortcut.modifiers.map((m) => {
      if (m === "mod") return modKey;
      if (m === "shift") return "Shift";
      if (m === "alt") return isMac ? "Option" : "Alt";
      return m;
    });
    return [...modifiers, shortcut.key].join("+");
  }

  subscribe(listener: KeyboardShortcutListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.getKeyFromEvent(event);
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      const handler = this.handlers.get(key);
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        void handler();
        this.emit({ type: "shortcut:executed", action: shortcut.action, key });
        return true;
      }
    }

    return false;
  }

  private buildCompositeKey(shortcut: Shortcut): string {
    const modifiers = [...shortcut.modifiers].sort().join("+");
    return modifiers ? `${modifiers}+${shortcut.key}` : shortcut.key;
  }

  attachGlobalListeners(): () => void {
    const handler = (event: KeyboardEvent) => {
      this.handleKeyDown(event);
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }

  toggleCommandPalette(): void {
    const overlay = document.getElementById("command-palette-overlay");
    if (overlay?.classList.contains("open")) {
      overlay.classList.remove("open");
      const input = document.getElementById("command-palette-input") as HTMLInputElement | null;
      input?.blur();
    } else {
      window.dispatchEvent(new CustomEvent("ocl-command-palette-toggle", { detail: { open: true, mode: "commands" } }));
    }
  }

  private getKeyFromEvent(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey || event.metaKey) parts.push("mod");
    if (event.shiftKey) parts.push("shift");
    if (event.altKey) parts.push("alt");

    const key = event.key.toLowerCase();
    if (!["control", "shift", "alt", "meta"].includes(key)) {
      parts.push(key);
    }

    return parts.sort().join("+");
  }

  private emit(event: KeyboardShortcutEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function createDefaultShortcuts(): Shortcut[] {
  return [
    { key: "k", modifiers: ["mod"], action: "commandPalette", description: "Command Palette", category: "navigation" },
    { key: "p", modifiers: ["mod"], action: "fileSwitcher", description: "File Switcher", category: "file" },
    { key: "s", modifiers: ["mod"], action: "saveFile", description: "Save File", category: "file" },
    { key: "w", modifiers: ["mod"], action: "closeTab", description: "Close Tab", category: "file" },
    { key: "f", modifiers: ["mod", "shift"], action: "searchInFiles", description: "Search in Files", category: "edit" },
    { key: "b", modifiers: ["mod"], action: "toggleSidebar", description: "Toggle Sidebar", category: "view" },
    { key: "`", modifiers: ["mod"], action: "toggleTerminal", description: "Toggle Terminal", category: "view" },
    { key: "t", modifiers: ["mod", "shift"], action: "toggleTheme", description: "Cycle Theme", category: "view" },
    { key: "z", modifiers: ["mod"], action: "undo", description: "Undo", category: "edit" },
    { key: "z", modifiers: ["mod", "shift"], action: "redo", description: "Redo", category: "edit" },
    { key: "1", modifiers: ["mod"], action: "switchTab1", description: "Switch to Tab 1", category: "navigation" },
    { key: "2", modifiers: ["mod"], action: "switchTab2", description: "Switch to Tab 2", category: "navigation" },
    { key: "3", modifiers: ["mod"], action: "switchTab3", description: "Switch to Tab 3", category: "navigation" },
    { key: "4", modifiers: ["mod"], action: "switchTab4", description: "Switch to Tab 4", category: "navigation" },
    { key: "5", modifiers: ["mod"], action: "switchTab5", description: "Switch to Tab 5", category: "navigation" },
  ];
}
