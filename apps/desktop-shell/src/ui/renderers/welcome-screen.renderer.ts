export class WelcomeScreenRenderer {
  public render(container: HTMLElement): void {
    container.innerHTML = `
      <div class="ocl-welcome-screen">
        <div class="ocl-welcome-title">Oclushion OS</div>
        <div class="ocl-welcome-subtitle">Tu sistema operativo para equipos de desarrollo. Abre un archivo, conecta un repositorio o deja que la IA tome el control.</div>
        <div class="ocl-welcome-shortcuts">
          <div class="ocl-welcome-shortcut" data-action="open-file">
            <span>📄</span> Abrir Archivo <kbd>Ctrl+O</kbd>
          </div>
          <div class="ocl-welcome-shortcut" data-action="open-repo">
            <span>📂</span> Conectar Repo <kbd>Ctrl+Shift+G</kbd>
          </div>
          <div class="ocl-welcome-shortcut" data-action="new-chat">
            <span>💬</span> Nuevo Chat IA <kbd>Ctrl+L</kbd>
          </div>
          <div class="ocl-welcome-shortcut" data-action="agi-mode">
            <span>🧠</span> Activar God Mode <kbd>Ctrl+Shift+A</kbd>
          </div>
          <div class="ocl-welcome-shortcut" data-action="open-browser">
            <span>🌍</span> Abrir Navegador <kbd>Ctrl+B</kbd>
          </div>
          <div class="ocl-welcome-shortcut" data-action="open-kanban">
            <span>📋</span> Ver Tareas <kbd>Ctrl+K</kbd>
          </div>
        </div>
      </div>
    `;
  }
}
