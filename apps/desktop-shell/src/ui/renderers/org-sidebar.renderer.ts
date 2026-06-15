import type { Organization } from "../../multiplayer/multiplayer.types";

export type OnlineMember = {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "idle" | "dnd";
};

export type OrgSidebarState = {
  organizations: Organization[];
  activeOrgId: string | null;
  onlineCounts: Record<string, number>;
  onlineMembers: OnlineMember[];
};

export class OrgSidebarRenderer {
  public render(container: HTMLElement, state: OrgSidebarState): void {
    const orgsHtml = state.organizations
      .map((org) => this.renderOrgIcon(org, state.activeOrgId === org.id, state.onlineCounts[org.id] || 0))
      .join("");

    const addIconHtml = `
      <div class="ocl-org-icon ocl-org-add" title="Add Organization" style="background-color: #333; color: #4CAF50;">
        +
      </div>
    `;

    const membersHtml = state.onlineMembers
      .map((m) => `
        <div class="ocl-member-avatar" title="${m.name} (${m.status})">
          ${m.avatar}
          <div class="ocl-member-status status-${m.status}"></div>
        </div>
      `)
      .join("");

    container.innerHTML = `
      <style>
        .ocl-org-sidebar-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding-bottom: 16px;
        }
        .ocl-org-top {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .ocl-org-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 12px;
        }
        .ocl-member-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          cursor: pointer;
          font-size: 16px;
          transition: transform 0.2s;
        }
        .ocl-member-avatar:hover {
          transform: scale(1.1);
        }
        .ocl-member-status {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid #000;
        }
        .status-online { background: #22c55e; }
        .status-idle { background: #f59e0b; }
        .status-dnd { background: #ef4444; }
      </style>

      <div class="ocl-org-sidebar-wrapper">
        <div class="ocl-org-top">
          <div class="ocl-org-icon ocl-org-home" title="Direct Messages" style="background-color: #5865F2;">
            Ocl
          </div>
          <div style="width: 32px; height: 2px; background-color: #333; border-radius: 1px;"></div>
          ${orgsHtml}
          ${addIconHtml}
        </div>
        <div class="ocl-org-bottom">
          ${membersHtml}
        </div>
      </div>
    `;
  }

  private renderOrgIcon(org: Organization, isActive: boolean, onlineCount: number): string {
    const colors = ["#E91E63", "#9C27B0", "#3F51B5", "#00BCD4", "#4CAF50", "#FF9800", "#795548"];
    const colorIndex = org.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const bgColor = colors[colorIndex];
    const initial = org.name.charAt(0).toUpperCase();

    const activeClass = isActive ? "active" : "";
    const onlineIndicator = onlineCount > 0 ? `<div class="online-dot" title="${onlineCount} online"></div>` : "";

    return `
      <div class="ocl-org-icon ${activeClass}" data-org-id="${org.id}" title="${org.name}" style="background-color: ${bgColor};">
        ${initial}
        ${onlineIndicator}
      </div>
    `;
  }
}
