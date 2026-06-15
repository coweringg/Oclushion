import type { DailyStandup, StandupMemberSummary } from "../../multiplayer/multiplayer.types";

export type AnalyticsState = {
  standup: DailyStandup | null;
  isOpen: boolean;
};

export class AnalyticsRenderer {
  public render(container: HTMLElement, state: AnalyticsState): void {
    const triggerHtml = `
      <div class="ocl-analytics-trigger" id="analytics-trigger" style="cursor: pointer; color: #ccc; font-size: 14px; font-weight: bold;">
        📊 Team Health
      </div>
    `;

    let contentHtml = '<div style="padding: 16px; color: #777;">No data available</div>';
    
    if (state.standup) {
      const items = state.standup.memberSummaries.map(member => this.renderMember(member)).join("");
      contentHtml = `
        <div style="padding: 12px; border-bottom: 1px solid #333; font-weight: bold; color: #fff;">
          Daily Standup
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
          ${items}
        </div>
      `;
    }

    const dropdownHtml = `
      <div class="ocl-analytics-dropdown" id="analytics-dropdown" style="display: ${state.isOpen ? "flex" : "none"}; position: absolute; top: 40px; right: 40px; width: 360px; background: #252526; border: 1px solid #333; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); flex-direction: column; z-index: 100;">
        ${contentHtml}
      </div>
    `;

    container.innerHTML = `
      <div style="position: relative;">
        ${triggerHtml}
        ${dropdownHtml}
      </div>
    `;
  }

  private renderMember(member: StandupMemberSummary): string {
    const colors = {
      excellent: "#4CAF50",
      needs_motivation: "#FF9800",
      burnout_risk: "#E91E63",
      ai_training_needed: "#00BCD4"
    };
    
    const statusColor = colors[member.wellbeingStatus];
    const statusLabels = {
      excellent: "Excellent",
      needs_motivation: "Needs Motivation",
      burnout_risk: "Burnout Risk",
      ai_training_needed: "Needs AI Training"
    };

    return `
      <div style="padding: 12px; border-bottom: 1px solid #333; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #fff; font-size: 14px;">${member.userName}</strong>
          <span style="background: ${statusColor}20; color: ${statusColor}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
            ${statusLabels[member.wellbeingStatus]}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #aaa;">
          <span>Health Score: <strong style="color: #fff;">${member.healthScore}/100</strong></span>
          <span>Stuck: <strong style="color: #fff;">${member.timeStuckOnTaskMinutes}m</strong></span>
        </div>
      </div>
    `;
  }
}
