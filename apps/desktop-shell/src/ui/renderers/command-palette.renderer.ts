export type CommandItem = {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  category: string;
};

export class CommandPaletteRenderer {
  private readonly defaultCommands: CommandItem[] = [
    { id: "open-file", icon: "📄", label: "Abrir Archivo", shortcut: "Ctrl+O", category: "Archivos" },
    { id: "go-to-line", icon: "#", label: "Ir a Línea", shortcut: "Ctrl+G", category: "Editor" },
    { id: "search-project", icon: "🔍", label: "Buscar en Proyecto", shortcut: "Ctrl+Shift+F", category: "Búsqueda" },
    { id: "toggle-terminal", icon: ">_", label: "Alternar Terminal", shortcut: "Ctrl+`", category: "Herramientas" },
    { id: "toggle-agi", icon: "🧠", label: "Activar/Desactivar God Mode", shortcut: "Ctrl+Shift+A", category: "AGI" },
    { id: "open-browser", icon: "🌍", label: "Abrir Navegador", shortcut: "Ctrl+B", category: "Herramientas" },
    { id: "open-chat", icon: "💬", label: "Chat del Equipo", shortcut: "Ctrl+L", category: "Colaboración" },
    { id: "open-figma", icon: "🎨", label: "Abrir Lienzo de Diseño", category: "Herramientas" },
    { id: "team-health", icon: "💚", label: "Ver Salud del Equipo", category: "Analytics" },
    { id: "notifications", icon: "🔔", label: "Ver Notificaciones", category: "Sistema" },
    { id: "settings", icon: "⚙️", label: "Configuración", shortcut: "Ctrl+,", category: "Sistema" },
    { id: "git-commit", icon: "📦", label: "Git Commit", category: "Git" },
    { id: "run-tests", icon: "🧪", label: "Ejecutar Tests", category: "Testing" },
    { id: "submit-review", icon: "✅", label: "Enviar a Revisión Interna", category: "Colaboración" },
    { id: "start-voice", icon: "🎤", label: "Iniciar Captura de Voz", shortcut: "Ctrl+Shift+V", category: "AGI" },
  ];

  public render(container: HTMLElement): void {
    container.innerHTML = `
      <div class="ocl-command-palette-overlay" id="command-palette-overlay">
        <div class="ocl-command-palette">
          <input class="ocl-command-input" id="command-palette-input" type="text" placeholder="Buscar comando, archivo o acción..." />
          <div class="ocl-command-results" id="command-palette-results">
            ${this.renderItems(this.defaultCommands)}
          </div>
        </div>
      </div>
    `;
  }

  public renderItems(items: CommandItem[]): string {
    return items.map(item => `
      <div class="ocl-command-item" data-command-id="${item.id}">
        <span>${item.icon}</span>
        <span>${item.label}</span>
        ${item.shortcut ? `<kbd>${item.shortcut}</kbd>` : ""}
      </div>
    `).join("");
  }

  public filterCommands(query: string): CommandItem[] {
    if (!query) return this.defaultCommands;
    const lower = query.toLowerCase();
    return this.defaultCommands.filter(c =>
      c.label.toLowerCase().includes(lower) ||
      c.category.toLowerCase().includes(lower)
    );
  }
}
