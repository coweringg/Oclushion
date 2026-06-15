export type OSTab = {
  id: string;
  title: string;
  icon: string;
};

export type OSTabsState = {
  tabs: OSTab[];
  activeTabId: string;
};

export class OSTabsRenderer {
  public render(container: HTMLElement, state: OSTabsState): void {
    const tabsHtml = state.tabs.map(tab => {
      const isActive = tab.id === state.activeTabId ? "active" : "";
      return `
        <div class="ocl-tab ${isActive}" data-tab-id="${tab.id}">
          <span>${tab.icon}</span>
          <span>${tab.title}</span>
          <span class="ocl-tab-close" data-action="close">×</span>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="ocl-tabs-bar">
        ${tabsHtml}
      </div>
    `;
  }
}
