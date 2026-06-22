import type { EventHandlerContext } from "./event-handlers";
import { logger } from "../utils/logger";
import "../components/ide-auto-approve";
import "../components/ide-titlebar";
import "../components/ide-sidebar";
import "../components/ide-chat-box";
import "../components/ide-command-palette";
import "../components/ide-workspace-panel";
import "../components/ide-ai-panel";
import "../components/ide-upgrade-modal";
import "../components/ide-auth-overlay";
import "../components/ide-audit-overlay";
import "../components/ide-marketplace-overlay";
import "../components/ide-central-shell";
import "../components/ide-terminal-panel";
import "../components/ide-onboarding-wizard";
import "../components/ide-canvas-spatial";
import { t } from "../i18n/translate";

export function renderMainLayout(ctx: EventHandlerContext): void {
  const { model } = ctx;
  const appEl = document.querySelector<HTMLDivElement>("#app");
  if (!appEl) {
    logger.error('AppLifecycle', '#app element not found in DOM');
    return;
  }

  appEl.innerHTML = `
    <main class="ide-container" aria-label="${t("appShell.sidebarAria")}">
      <div class="background-glow background-glow--violet"></div>
      <div class="background-glow background-glow--blue"></div>
      <div id="auth-root"><ide-auth-overlay></ide-auth-overlay></div>
      <div id="onboarding-root"><ide-onboarding-wizard></ide-onboarding-wizard></div>
      <ide-titlebar credits-used="${ctx.sessionUsageService.getSnapshot().creditsUsed}"></ide-titlebar>

      <ide-sidebar></ide-sidebar>
      <div id="marketplace-root"><ide-marketplace-overlay></ide-marketplace-overlay></div>
      <div id="installation-progress-root"></div>
      <div id="audit-root"><ide-audit-overlay></ide-audit-overlay></div>
      <div id="settings-root"><ide-settings-overlay></ide-settings-overlay></div>
      <div id="upgrade-root"><ide-upgrade-modal></ide-upgrade-modal></div>
      <ide-workspace-panel></ide-workspace-panel>

      <ide-central-shell id="central-shell" class="editor-shell" data-testid="central-shell" aria-label="${t("workspace.centralEditor")}"></ide-central-shell>

      <ide-canvas-spatial id="spatial-canvas-root" data-testid="spatial-canvas-root"></ide-canvas-spatial>

      <ide-ai-panel tokens-sent="${ctx.sessionUsageService.getSnapshot().tokensSent}" credits-used="${ctx.sessionUsageService.getSnapshot().creditsUsed}"></ide-ai-panel>
      <ide-terminal-panel id="terminal-panel-root" data-testid="terminal-panel-root"></ide-terminal-panel>
      <div class="terminal-bottom-bar">
        <button id="terminal-toggle-button" class="terminal-toggle" type="button" title="${t("workspace.toggleTerminal")}" data-shortcut="Ctrl+\`">>_</button>
      </div>
    </main>
  `;
}