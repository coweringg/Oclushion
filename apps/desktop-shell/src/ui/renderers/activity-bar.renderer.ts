export type ActivityTab = {
  id: string;
  icon: string;
  title: string;
  hasBadge?: boolean;
};

export type ActivityBarState = {
  tabs: ActivityTab[];
  activeTabId: string;
};

export class ActivityBarRenderer {
  public render(container: HTMLElement, state: ActivityBarState): void {
    const existingStyle = document.getElementById("ocl-activity-bar-style");
    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = "ocl-activity-bar-style";
      style.textContent = `
        .ocl-activity-tab {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          position: relative;
          color: #858585;
          transition: color 0.2s;
        }

        .ocl-activity-tab:hover {
          color: #e2e8f0;
        }

        .ocl-activity-tab.active {
          color: #ffffff;
        }

        .ocl-activity-tab.active::before {
          content: "";
          position: absolute;
          left: -1px; 
          top: 0;
          bottom: 0;
          width: 2px;
          background-color: #007acc;
        }

        .ocl-activity-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          background-color: #007acc;
          border-radius: 50%;
          border: 2px solid #1e1e1e;
        }
      `;
      document.head.appendChild(style);
    }

    const tabsHtml = state.tabs.map(tab => `
      <div class="ocl-activity-tab ${state.activeTabId === tab.id ? 'active' : ''}" data-tab="${tab.id}" title="${tab.title}">
        <span>${tab.icon}</span>
        ${tab.hasBadge ? '<div class="ocl-activity-badge"></div>' : ''}
      </div>
    `).join('');

    container.innerHTML = tabsHtml;
  }
}
