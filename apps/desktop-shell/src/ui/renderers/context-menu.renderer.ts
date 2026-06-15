export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  isDivider?: boolean;
  danger?: boolean;
};

export type ContextMenuState = {
  isVisible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  targetId: string | null;
  targetType: 'file' | 'editor' | 'generic';
};

export class ContextMenuRenderer {
  public render(container: HTMLElement, state: ContextMenuState): void {
    const existingStyle = document.getElementById("ocl-context-menu-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-context-menu-style";
      style.textContent = `
        .ocl-context-menu {
          position: fixed;
          background: #252526;
          border: 1px solid #454545;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          border-radius: 6px;
          padding: 4px 0;
          min-width: 220px;
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          color: #cccccc;
          user-select: none;
        }

        .ocl-cm-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 16px 6px 12px;
          cursor: pointer;
        }

        .ocl-cm-item-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ocl-cm-item:hover {
          background-color: #04395e;
          color: #ffffff;
        }

        .ocl-cm-item.danger:hover {
          background-color: #f14c4c;
        }

        .ocl-cm-shortcut {
          font-size: 11px;
          color: #858585;
        }

        .ocl-cm-item:hover .ocl-cm-shortcut {
          color: #cccccc;
        }

        .ocl-cm-divider {
          height: 1px;
          background-color: #454545;
          margin: 4px 0;
        }
      `;
      document.head.appendChild(style);
    }

    if (!state.isVisible) {
      container.innerHTML = '';
      return;
    }

    const menuHtml = `
      <div class="ocl-context-menu" style="left: ${state.x}px; top: ${state.y}px;">
        ${state.items.map(item => {
          if (item.isDivider) {
            return '<div class="ocl-cm-divider"></div>';
          }
          return `
            <div class="ocl-cm-item ${item.danger ? 'danger' : ''}" data-action="${item.id}">
              <div class="ocl-cm-item-left">
                ${item.icon ? `<span>${item.icon}</span>` : '<span style="width:14px"></span>'}
                <span>${item.label}</span>
              </div>
              ${item.shortcut ? `<span class="ocl-cm-shortcut">${item.shortcut}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = menuHtml;

    const menuEl = container.querySelector(".ocl-context-menu") as HTMLElement;
    if (menuEl) {
      const rect = menuEl.getBoundingClientRect();
      const rightOverflow = rect.right - window.innerWidth;
      const bottomOverflow = rect.bottom - window.innerHeight;
      
      let newX = state.x;
      let newY = state.y;

      if (rightOverflow > 0) newX -= rightOverflow;
      if (bottomOverflow > 0) newY -= bottomOverflow;

      if (newX !== state.x || newY !== state.y) {
        menuEl.style.left = `${newX}px`;
        menuEl.style.top = `${newY}px`;
      }
    }
  }
}
