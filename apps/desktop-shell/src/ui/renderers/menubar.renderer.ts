export type MenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
};

export type MenuCategory = {
  id: string;
  label: string;
  items: MenuItem[];
};

export type MenubarState = {
  categories: MenuCategory[];
  activeCategoryId: string | null;
};

export class MenubarRenderer {
  public render(container: HTMLElement, state: MenubarState): void {
    const existingStyle = document.getElementById("ocl-menubar-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-menubar-style";
      style.textContent = `
        .ocl-menubar {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 32px;
          padding: 0 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
          color: #e2e8f0;
          user-select: none;
        }

        .ocl-menubar-item {
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          position: relative;
          transition: background 0.1s;
        }

        .ocl-menubar-item:hover, .ocl-menubar-item.active {
          background: rgba(255, 255, 255, 0.1);
        }

        .ocl-menubar-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: #1e1e24;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          min-width: 220px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 1000;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ocl-dropdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          color: #f8fafc;
        }

        .ocl-dropdown-item:hover {
          background: #4f46e5;
        }

        .ocl-dropdown-item.disabled {
          color: #64748b;
          cursor: default;
        }

        .ocl-dropdown-item.disabled:hover {
          background: transparent;
        }

        .ocl-dropdown-shortcut {
          font-size: 11px;
          color: #94a3b8;
        }

        .ocl-dropdown-item:hover:not(.disabled) .ocl-dropdown-shortcut {
          color: #c7d2fe;
        }
      `;
      document.head.appendChild(style);
    }

    const categoriesHtml = state.categories.map(cat => {
      const isActive = state.activeCategoryId === cat.id;
      
      const dropdownHtml = isActive ? `
        <div class="ocl-menubar-dropdown">
          ${cat.items.map(item => `
            <div class="ocl-dropdown-item ${item.disabled ? 'disabled' : ''}" data-action="${item.id}">
              <span>${item.label}</span>
              ${item.shortcut ? `<span class="ocl-dropdown-shortcut">${item.shortcut}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="ocl-menubar-item ${isActive ? 'active' : ''}" data-category="${cat.id}">
          ${cat.label}
          ${dropdownHtml}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ocl-menubar">
        ${categoriesHtml}
      </div>
    `;
  }
}
