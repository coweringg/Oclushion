import type { OSNotification, NotificationSettings } from "../../os/os.types";

export type NotificationsState = {
  notifications: OSNotification[];
  settings: NotificationSettings;
  isOpen: boolean;
};

export class NotificationsRenderer {
  public render(container: HTMLElement, state: NotificationsState): void {
    const unreadCount = state.notifications.filter(n => !n.isRead).length;
    const badgeHtml = unreadCount > 0 ? `<div class="ocl-notif-badge">${unreadCount}</div>` : "";
    
    const bellHtml = `
      <div class="ocl-notif-bell" id="notif-bell-trigger">
        🔔
        ${badgeHtml}
      </div>
    `;

    const muteLowClass = state.settings.muteLow ? "active" : "";
    const muteMediumClass = state.settings.muteMedium ? "active" : "";
    
    const headerHtml = `
      <div style="padding: 12px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: #fff;">Inbox</span>
        <div style="display: flex; gap: 8px;">
          <button class="ocl-notif-mute-btn ${muteLowClass}" data-severity="low">Mute Low</button>
          <button class="ocl-notif-mute-btn ${muteMediumClass}" data-severity="medium">Mute Mid</button>
        </div>
      </div>
    `;

    const itemsHtml = state.notifications.map(n => `
      <div class="ocl-notif-item ${n.severity}">
        <div class="ocl-notif-title">${n.title}</div>
        <div class="ocl-notif-msg">${n.message}</div>
      </div>
    `).join("");

    const dropdownHtml = `
      <div class="ocl-notif-dropdown ${state.isOpen ? "open" : ""}" id="notif-dropdown">
        ${headerHtml}
        ${itemsHtml || '<div style="padding: 16px; color: #777; text-align: center;">No notifications</div>'}
      </div>
    `;

    container.innerHTML = `
      <div style="position: relative;">
        ${bellHtml}
        ${dropdownHtml}
      </div>
    `;
  }
}
