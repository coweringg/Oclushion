import { renderEmptyState } from "../empty-state";

export type CommandItem = {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  category: string;
};

export type PaletteMode = "commands" | "files";

export class CommandPaletteRenderer {
  public render(id: string, mode: PaletteMode, placeholder?: string): string {
    const ph = placeholder ?? "Search commands, files, or actions...";
    return `
      <div class="ocl-command-palette-overlay" id="${id}">
        <div class="ocl-command-palette" role="dialog" aria-label="Command palette">
          <div class="ocl-command-mode-hint">${mode === "files" ? "Ctrl+P" : "Ctrl+Shift+P"}</div>
          <input
            class="ocl-command-input"
            id="command-palette-input"
            type="text"
            placeholder="${ph}"
            autofocus
            spellcheck="false"
            data-palette-mode="${mode}"
          />
          <div class="ocl-command-results" id="command-palette-results">
            <div class="ocl-command-loading">Type to search...</div>
          </div>
          <div class="ocl-command-footer">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>⎋ Close</span>
          </div>
        </div>
      </div>
    `;
  }

  public renderGroupedItems(
    commands: CommandItem[],
    query: string,
    selectedIndex: number,
    prefix: string,
  ): string {
    if (!commands.length) {
      const desc = query
        ? `No results for "${query}". Try a different search term.`
        : "No commands available.";
      return renderEmptyState({
        icon: "🔍",
        title: `No ${prefix === ">" ? "commands" : prefix === "@" ? "files" : "results"} found`,
        description: desc,
        compact: true,
        iconVariant: "muted",
      });
    }

    const groups = new Map<string, CommandItem[]>();
    for (const cmd of commands) {
      const group = groups.get(cmd.category) ?? [];
      group.push(cmd);
      groups.set(cmd.category, group);
    }

    let globalIndex = 0;
    const parts: string[] = [];
    for (const [category, items] of groups) {
      parts.push(`<div class="ocl-command-group-header">${category}</div>`);
      for (const item of items) {
        const isSelected = globalIndex === selectedIndex;
        const highlighted = this.highlightLabel(item.label, query);
        parts.push(`
          <div class="ocl-command-item ${isSelected ? "ocl-command-item--selected" : ""}" data-command-id="${item.id}" data-index="${globalIndex}">
            <span class="ocl-command-item-icon">${item.icon}</span>
            <span class="ocl-command-item-label">${highlighted}</span>
            <span class="ocl-command-item-spacer"></span>
            ${item.shortcut ? `<kbd>${item.shortcut}</kbd>` : ""}
          </div>
        `);
        globalIndex++;
      }
    }

    return parts.join("");
  }

  private highlightLabel(label: string, query: string): string {
    if (!query.trim()) return escapeHtml(label);

    const lower = label.toLowerCase();
    const qLower = query.toLowerCase();
    let result = "";
    let lastIndex = 0;

    for (let i = 0; i < qLower.length; i++) {
      const char = qLower[i];
      if (char === undefined) break;
      const idx = lower.indexOf(char, lastIndex);
      if (idx === -1) break;
      if (idx > lastIndex) {
        result += escapeHtml(label.slice(lastIndex, idx));
      }
      const matchedChar = label[idx];
      if (matchedChar === undefined) break;
      result += `<mark>${escapeHtml(matchedChar)}</mark>`;
      lastIndex = idx + 1;
    }
    if (lastIndex < label.length) {
      result += escapeHtml(label.slice(lastIndex));
    }
    return result || escapeHtml(label);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
