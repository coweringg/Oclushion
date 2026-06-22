import { renderEmptyState } from "../ui/empty-state";
import type { FileTreeNode, RepoScanResult } from "../repo-scanner";
import type { PackedRepositoryContext } from "../context.service";
import type { SafeDiffProposal } from "../safe-diff.service";
import type { MarketplaceSnapshot, InstallationProgress } from "../marketplace/marketplace.types";
import type { EnterpriseSkill } from "../types/enterprise-registry";
import type { AuditEvent } from "../audit.service";
import type { OrchestratorSnapshot } from "../agents/types";
import type { KanbanTask, KanbanColumn } from "../kanban/kanban.types";
import type { FastApplySession } from "../fast-apply/fast-apply.types";
import type { FileSnapshot } from "../fast-apply/fast-apply.types";
import type { PreviewConfig } from "../preview/preview.types";
import type { DeployState } from "../shipper/shipper.types";
import type { MultiplayerRoom } from "../multiplayer/multiplayer.types";
import type { GitStatusMap } from "../editor/git-status.service";
import { kanbanColumns } from "../kanban/kanban.types";
import { t } from "../i18n/translate";
import { escapeHtml, formatTokenCount, formatAuditType } from "../ui/utils/format";

export function renderBestSkillpackList(skillpacks?: Array<{ skillpack: { name: string; description: string }; state: string }>): string {
  const profiles = skillpacks?.length
    ? skillpacks.map((sp) => [sp.skillpack.name, sp.skillpack.description, sp.state] as const)
    : [
        ["Backend", "Node.js, Express, TypeScript", "active"],
        ["Frontend", "React, Next.js, Tailwind", ""],
        ["Security", "OWASP, SAST, Audit", "security"],
        ["DevOps", "Docker, Kubernetes, CI/CD", "devops"],
        ["Architect", "System Design, Patterns", ""],
      ];
  return profiles
    .map(
      ([name, description, state]) => `
        <button class="best-profile-card ${state}" type="button">
          <span class="best-profile-icon"></span>
          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(description)}</small>
          </span>
          <i>${state === "active" ? t("common.active") : ""}</i>
        </button>
      `,
    )
    .join("");
}

export function renderRepoTree(
  nodes: FileTreeNode[],
  collapsedDirectories: Set<string>,
  depth = 0,
): string {
  return nodes
    .map((node) => {
      const collapsed = node.kind === "directory" && collapsedDirectories.has(node.path);
      const icon = getFileTreeIcon(node, collapsed);
      const gitIndicator = getGitStatusIndicator(node.gitStatus);
      const children =
        !collapsed && node.children?.length
          ? renderRepoTree(node.children, collapsedDirectories, depth + 1)
          : "";
      return `
        <button class="repo-node ${node.kind}" style="--depth: ${depth}" type="button" data-node-path="${node.path}" data-node-kind="${node.kind}">
          <span>${icon}</span>
          <span>${node.name}</span>
          ${gitIndicator ? `<span class="git-status-indicator ${node.gitStatus}">${gitIndicator}</span>` : ""}
        </button>
        ${children}
      `;
    })
    .join("");
}

export function getGitStatusIndicator(status: string | undefined): string {
  switch (status) {
    case "modified": return "M";
    case "added": return "A";
    case "deleted": return "D";
    case "renamed": return "R";
    case "untracked": return "?";
    default: return "";
  }
}

export function getFileTreeIcon(node: FileTreeNode, collapsed: boolean): string {
  if (node.kind === "directory") {
    return collapsed ? "+" : "-";
  }
  const extension = node.extension ?? "";
  const icons: Record<string, string> = {
    ts: "TS",
    tsx: "TSX",
    js: "JS",
    jsx: "JSX",
    json: "{}",
    md: "MD",
    rs: "RS",
    py: "PY",
    go: "GO",
    yml: "YML",
    yaml: "YML",
    toml: "TOML",
  };
  return icons[extension] ?? (node.type === "infra" ? "OPS" : "FILE");
}

export function getRepoName(result: RepoScanResult): string {
  if (result.rootPath.startsWith("mock://")) {
    return result.rootPath.replace("mock://", "");
  }
  return result.rootPath.split(/[\\/]/).filter(Boolean).at(-1) ?? "Repository";
}

export function renderRepoCard(
  result: RepoScanResult,
  collapsedDirectories: Set<string>,
  gitStatuses?: GitStatusMap,
): string {
  return `
    <header>
      <span>${t("workspace.repository")}</span>
      <button id="open-repository-button" type="button">${t("workspace.openRepository")}</button>
    </header>
    <strong id="repo-name">${getRepoName(result)}</strong>
    <small id="repo-meta">${escapeHtml(result.rootPath)} - ${result.totalFiles} files indexed - ${result.detectedLanguage}${result.detectedFramework ? ` - ${result.detectedFramework}` : ""}</small>
    <p class="repo-summary" id="repo-summary">${result.repoSummary}</p>
    <div id="repo-tree" class="repo-tree">${renderRepoTree(buildFileTree(result, gitStatuses), collapsedDirectories)}</div>
  `;
}

export function renderContextMeter(context: PackedRepositoryContext): string {
  const percentage = Math.min(100, Math.round((context.usedTokens / context.tokenLimit) * 100));
  return `
    <section class="context-meter" aria-label="Context token usage">
      <div>
        <span>${t("repoIntel.contextLoad")}</span>
        <strong id="context-load-label">${formatTokenCount(context.usedTokens)} / ${formatTokenCount(context.tokenLimit)} tokens</strong>
      </div>
      <div class="context-bar" aria-hidden="true">
        <span id="context-load-bar" style="width: ${percentage}%"></span>
      </div>
      <small id="context-load-detail">${context.files.length} files packed - ${context.droppedFiles} dropped</small>
    </section>
  `;
}

export function renderSafeDiffPanel(safeDiffProposals: SafeDiffProposal[]): string {
  const pendingCount = safeDiffProposals.filter((proposal) => proposal.status === "pending").length;
  const proposalCount = safeDiffProposals.length;

  if (!proposalCount) {
    return `
      <header>
        <span>${t("safeDiff.empty")}</span>
        <strong>Safe</strong>
      </header>
      <div class="safe-diff-empty">
        <strong>${t("safeDiff.title")}</strong>
        <p>${t("safeDiff.empty")}</p>
      </div>
    `;
  }

  return `
    <header>
      <span>${t("safeDiff.quarantined", { count: proposalCount })}</span>
      <strong>${t("safeDiff.pending", { count: pendingCount })}</strong>
    </header>
    <div class="proposal-list">
      ${safeDiffProposals.map(renderSafeDiffProposal).join("")}
    </div>
  `;
}

export function renderSafeDiffProposal(proposal: SafeDiffProposal): string {
  const isCommand = proposal.kind === "command";
  const statusCopy = proposal.status === "pending" ? t("safeDiff.awaiting") : proposal.status;
  const language = proposal.language || "plain";

  return `
    <article class="proposal-card ${proposal.kind} ${proposal.status}" data-proposal-id="${proposal.id}">
      <header>
        <div>
          <span class="proposal-kind">${isCommand ? t("safeDiff.command") : t("safeDiff.code")}</span>
          <strong>${proposal.title}</strong>
        </div>
        <small>${statusCopy}</small>
      </header>
      <pre><code data-language="${language}">${escapeHtml(proposal.content)}</code></pre>
      <footer>
        ${
          isCommand
            ? `<button class="run-command" type="button" data-action="run-command" data-proposal-id="${proposal.id}">${t("safeDiff.runCommand")}</button>`
            : `<button class="approve" type="button" data-action="fast-apply" data-proposal-id="${proposal.id}">${t("safeDiff.fastApply")}</button>
               <button class="approve secondary" type="button" data-action="approve" data-proposal-id="${proposal.id}">${t("safeDiff.applyEditor")}</button>`
        }
        <button type="button" data-action="reject" data-proposal-id="${proposal.id}">${t("common.reject")}</button>
        <button type="button" data-action="explain" data-proposal-id="${proposal.id}">${t("common.explain")}</button>
      </footer>
    </article>
  `;
}

function highlightMatches(text: string, matches?: Array<{ start: number; end: number }>): string {
  if (!matches || matches.length === 0) return escapeHtml(text);
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let lastEnd = 0;
  for (const m of sorted) {
    if (m.start < lastEnd) continue;
    if (m.start > lastEnd) parts.push(escapeHtml(text.slice(lastEnd, m.start)));
    parts.push(`<mark>${escapeHtml(text.slice(m.start, m.end))}</mark>`);
    lastEnd = m.end;
  }
  if (lastEnd < text.length) parts.push(escapeHtml(text.slice(lastEnd)));
  return parts.join("");
}

export function renderMarketplaceSkillCard(
  skill: MarketplaceSnapshot["skills"][number],
  marketplaceDownloads: Set<string>,
  matches?: Array<{ start: number; end: number }>,
): string {
  const isDownloading = marketplaceDownloads.has(skill.id);
  const state = isDownloading ? "downloading" : skill.installState;
  const lockReason = skill.lockResult?.reason;
  const upgradeLabel = skill.lockResult?.upgradeLabel ?? t("common.upgradeRequired");
  const action =
    state === "locked"
      ? `<div class="marketplace-locked-cta">
          <span class="marketplace-lock-reason">${escapeHtml(lockReason ?? "")}</span>
          <button class="marketplace-action" type="button" data-marketplace-action="upgrade-plan">${escapeHtml(upgradeLabel)}</button>
        </div>`
      : state === "update_available"
        ? `<button class="marketplace-action" type="button" data-marketplace-action="install-skill" data-skill-id="${skill.id}">${t("common.update")}</button>`
        : state === "installed"
          ? `<button class="marketplace-action secondary" type="button" data-marketplace-action="uninstall-skill" data-skill-id="${skill.id}">${t("common.uninstall")}</button>`
          : `<button class="marketplace-action" type="button" data-marketplace-action="install-skill" data-skill-id="${skill.id}" ${isDownloading ? "disabled" : ""}>${isDownloading ? t("common.downloading") : t("common.install")}</button>`;

  return `
    <article class="marketplace-card ${state}">
      <div class="marketplace-card-top">
        <span>${skill.category}</span>
        <strong>${state === "update_available" ? t("common.update") : state === "installed" ? t("common.installed") : state === "downloading" ? t("common.downloading") : skill.tier}</strong>
      </div>
      <h3>${highlightMatches(skill.name, matches)}</h3>
      <p>${highlightMatches(skill.description, matches)}</p>
      <dl>
        <div><dt>${t("common.version")}</dt><dd>${skill.version}</dd></div>
        <div><dt>${t("common.sha256")}</dt><dd>${skill.sha256.slice(0, 12)}...</dd></div>
      </dl>
      <small>${skill.previewLines.slice(0, 2).map(escapeHtml).join(" ")}</small>
      <footer>${action}</footer>
    </article>
  `;
}

export function renderMarketplaceToolCard(
  tool: MarketplaceSnapshot["tools"][number],
  marketplaceDownloads: Set<string>,
): string {
  const isDownloading = marketplaceDownloads.has(tool.id);
  const state = isDownloading ? "downloading" : tool.installState;
  const action =
    state === "installed"
      ? `<button class="marketplace-action secondary" type="button" data-marketplace-action="uninstall-tool" data-tool-id="${tool.id}">${t("common.uninstall")}</button>`
      : `<button class="marketplace-action" type="button" data-marketplace-action="install-tool" data-tool-id="${tool.id}" ${isDownloading ? "disabled" : ""}>${isDownloading ? t("common.downloading") : state === "update_available" ? t("common.update") : t("common.install")}</button>`;

  return `
    <article class="marketplace-card ${state}">
      <div class="marketplace-card-top">
        <span>${tool.platform}</span>
        <strong>${state === "installed" ? t("common.installed") : tool.version}</strong>
      </div>
      <h3>${tool.name}</h3>
      <p>${tool.description}</p>
      <dl>
        <div><dt>${t("common.binary")}</dt><dd>${tool.requiredBin}</dd></div>
        <div><dt>${t("common.protected")}</dt><dd>${tool.gitignoreEntry}</dd></div>
      </dl>
      <footer>${action}</footer>
    </article>
  `;
}

export function renderInstallationProgress(progress: InstallationProgress | null): string {
  if (!progress) return "";

  const isComplete = progress.status === "completed";
  const isFailed = progress.status === "failed";
  const isCancelled = progress.status === "cancelled";

  const statusIcon = isComplete ? "&#10003;" : isFailed ? "&#10007;" : "&#8634;";
  const statusClass = isComplete ? "success" : isFailed ? "error" : isCancelled ? "cancelled" : "active";

  const taskRows = progress.tasks
    .map((task) => {
      const stepIcon =
        task.status === "completed"
          ? "&#10003;"
          : task.status === "failed"
            ? "&#10007;"
            : task.status === "active"
              ? "&#8634;"
              : "&#8987;";
      const stepLabel =
        task.status === "completed"
          ? t("installation.downloaded")
          : task.status === "failed"
            ? t("installation.failed")
            : task.step === "downloading"
              ? t("installation.downloading")
              : task.step === "verifying"
                ? t("installation.verifying")
                : task.step === "writing"
                  ? t("installation.writing")
                  : t("installation.activating");

      return `
        <div class="installation-task ${task.status}">
          <span class="installation-task-icon">${stepIcon}</span>
          <span class="installation-task-name">${escapeHtml(task.name)}</span>
          <span class="installation-task-status">${stepLabel}</span>
        </div>
      `;
    })
    .join("");

  const footerMessage = isComplete
    ? t("installation.complete")
    : isFailed
      ? t("installation.failedMessage")
      : t("installation.aiPaused");

  return `
    <section id="installation-progress" class="installation-progress ${statusClass}" role="status" aria-live="polite">
      <div class="installation-progress-panel">
        <header>
          <span class="installation-progress-icon">${statusIcon}</span>
          <h3>${escapeHtml(progress.title)}</h3>
        </header>
        <div class="installation-tasks">
          ${taskRows}
        </div>
        <div class="installation-progress-bar">
          <div class="installation-progress-fill" style="width: ${progress.totalProgress}%"></div>
        </div>
        <footer class="installation-progress-footer">
          <span>${progress.totalProgress}%</span>
          <span>${footerMessage}</span>
        </footer>
      </div>
    </section>
  `;
}

export function renderMcpSettingsRows(mcpServers: Array<{ id: string; name: string; enabled: boolean; apiToken?: string; baseUrl?: string }>): string {
  return mcpServers
    .map(
      (server) => `
        <div class="integration-row" data-mcp-row="${server.id}">
          <label>
            <input type="checkbox" data-mcp-enabled="${server.id}" ${server.enabled ? "checked" : ""} />
            <strong>${server.name}</strong>
          </label>
          <input data-mcp-token="${server.id}" type="password" placeholder="${server.apiToken ? t("settings.tokenStored") : t("settings.accessToken")}" />
          <input data-mcp-url="${server.id}" type="text" value="${escapeHtml(server.baseUrl ?? "")}" />
          <button class="marketplace-action secondary" data-mcp-save="${server.id}" type="button">${t("common.save")}</button>
        </div>
      `,
    )
    .join("");
}

export function renderIdeLanguageSwitcher(currentLanguage: string): string {
  const locales = [
    { code: "en", label: "EN", flag: "🇺🇸" },
    { code: "es", label: "ES", flag: "🇪🇸" },
    { code: "fr", label: "FR", flag: "🇫🇷" },
    { code: "zh", label: "ZH", flag: "🇨🇳" },
    { code: "pt", label: "PT", flag: "🇧🇷" },
    { code: "de", label: "DE", flag: "🇩🇪" },
    { code: "ja", label: "JA", flag: "🇯🇵" },
    { code: "ko", label: "KO", flag: "🇰🇷" },
  ] as const;

  return `
    <div class="ocl-lang-switcher-ide" aria-label="${t("settings.language")}">
      ${locales
        .map(
          ({ code, label, flag }) => `
            <button class="lang-btn ${currentLanguage === code ? "active" : ""}" data-lang="${code}" title="${label}" type="button">
              <span aria-hidden="true">${flag}</span> ${label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderAuditEvent(event: AuditEvent): string {
  return `
    <article class="audit-event ${event.syncStatus}">
      <div class="audit-event-icon">${event.type.slice(0, 1)}</div>
      <div>
        <header>
          <strong>${formatAuditType(event.type)}</strong>
          <span>${new Date(event.timestamp).toLocaleString()}</span>
        </header>
        <p>${escapeHtml(event.summary)}</p>
        <footer>
          <span>${event.plan}</span>
          <span>${event.syncStatus.replaceAll("_", " ")}</span>
          <span>${escapeHtml(event.workspaceId)}</span>
        </footer>
      </div>
    </div>
  `;
}

export function renderEnterpriseManageOverlay(
  open: boolean,
  skills: EnterpriseSkill[],
  error: string,
  submitting: boolean,
  editingId: string | null,
): string {
  if (!open) return "";
  const rows = skills.length
    ? skills.map((s) => {
        const isEditing = editingId === s.id;
        const statusClass = s.status === "approved" ? "status-ok" : s.status === "archived" ? "status-archived" : "status-pending";
        return isEditing
          ? `
        <article class="enterprise-edit-form" data-enterprise-id="${s.id}">
          <label class="field"><span>${t("common.name")}</span><input class="enterprise-name-input" type="text" value="${escapeHtml(s.name)}" /></label>
          <label class="field"><span>${t("common.description")}</span><textarea class="enterprise-desc-input">${escapeHtml(s.description)}</textarea></label>
          <label class="field"><span>${t("common.version")}</span><input class="enterprise-version-input" type="text" value="${escapeHtml(s.version)}" /></label>
          <label class="field"><span>Content</span><textarea class="enterprise-content-input" rows="5">${escapeHtml(s.content)}</textarea></label>
          <div class="marketplace-header-actions">
            <button class="marketplace-action secondary" type="button" data-enterprise-action="save-edit" data-enterprise-id="${s.id}">${t("common.save")}</button>
            <button class="marketplace-action secondary" type="button" data-enterprise-action="cancel-edit">${t("common.cancel")}</button>
          </div>
        </article>`
          : `
        <article class="marketplace-card ${statusClass}" data-enterprise-id="${s.id}">
          <div class="marketplace-card-top">
            <span>${escapeHtml(s.category)}</span>
            <strong>${escapeHtml(s.status)}</strong>
          </div>
          <h3>${escapeHtml(s.name)}</h3>
          <p>${escapeHtml(s.description)}</p>
          <dl>
            <div><dt>${t("common.version")}</dt><dd>${escapeHtml(s.version)}</dd></div>
          </dl>
          <footer class="marketplace-header-actions">
            <button class="marketplace-action secondary" type="button" data-enterprise-action="edit" data-enterprise-id="${s.id}">${t("common.edit")}</button>
            ${s.status === "pending" ? `<button class="marketplace-action" type="button" data-enterprise-action="approve" data-enterprise-id="${s.id}">${t("common.approve")}</button>` : ""}
            <button class="marketplace-action secondary" type="button" data-enterprise-action="delete" data-enterprise-id="${s.id}">${t("common.delete")}</button>
          </footer>
        </article>`;
      }).join("")
    : `<article class="marketplace-card"><h3>${t("marketplace.catalogUnavailable")}</h3><p>No enterprise skills yet. Create one below.</p></article>`;
  return `
    <section id="enterprise-manage-overlay" class="marketplace-overlay" role="dialog" aria-modal="true">
      <div class="marketplace-panel">
        <header>
          <div>
            <span>Enterprise</span>
            <h2>${t("common.manage")} Enterprise Skills</h2>
            ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
          </div>
          <div class="marketplace-header-actions">
            <button id="enterprise-manage-close-button" type="button" aria-label="${t("marketplace.close")}">${t("common.close")}</button>
          </div>
        </header>
        <div class="marketplace-grid">${rows}</div>
        <hr />
        <form id="enterprise-create-form">
          <h3>Create New Skill</h3>
          <label class="field"><span>${t("common.name")}</span><input id="enterprise-create-name" type="text" required ${submitting ? "disabled" : ""} /></label>
          <label class="field"><span>${t("common.description")}</span><textarea id="enterprise-create-desc" required ${submitting ? "disabled" : ""}></textarea></label>
          <label class="field"><span>Category</span><input id="enterprise-create-category" type="text" value="fullstack" ${submitting ? "disabled" : ""} /></label>
          <label class="field"><span>${t("common.version")}</span><input id="enterprise-create-version" type="text" value="1.0.0" ${submitting ? "disabled" : ""} /></label>
          <label class="field"><span>Tags (comma-separated)</span><input id="enterprise-create-tags" type="text" placeholder="typescript,react,api" ${submitting ? "disabled" : ""} /></label>
          <label class="field"><span>Content (markdown)</span><textarea id="enterprise-create-content" rows="10" required ${submitting ? "disabled" : ""}></textarea></label>
          <button class="marketplace-action" type="submit" ${submitting ? "disabled" : ""}>${submitting ? t("common.saving") : t("common.create")}</button>
        </form>
      </div>
    </section>
  `;
}

export function renderFastApplyPanel(fastApplySessions: FastApplySession[]): string {
  const pending = fastApplySessions.flatMap((session) =>
    session.snapshots.filter((snapshot) => session.status === "pending"),
  );
  if (!pending.length) {
    return `
      <section class="v3-panel">
        <h2>${t("fastApply.title")}</h2>
        <p>${t("fastApply.idle")}</p>
      </section>
    `;
  }
  return `
    <section class="v3-panel hot">
      <h2>${t("fastApply.session")}</h2>
      <p>${pending.length} ${t("fastApply.pending")}</p>
      <div class="v3-list">
        ${pending.map((snapshot) => renderFastApplyFile(snapshot, fastApplySessions)).join("")}
      </div>
      <footer>
        <button data-fast-apply-action="accept-all" type="button">${t("fastApply.acceptAll")}</button>
        <button data-fast-apply-action="revert-all" type="button">${t("fastApply.revertAll")}</button>
      </footer>
    </section>
  `;
}

function renderFastApplyFile(snapshot: FileSnapshot, fastApplySessions: FastApplySession[]): string {
  const filename = snapshot.path.split("/").pop() ?? snapshot.path;
  const sessionId = fastApplySessions.find((session) =>
    session.snapshots.some((s) => s.path === snapshot.path),
  )?.id ?? "";
  return `
    <article class="v3-row">
      <strong>${escapeHtml(filename)}</strong>
      <span>+${snapshot.linesAdded} / -${snapshot.linesRemoved}</span>
      <button data-fast-apply-action="accept-file" data-fast-apply-session="${sessionId}" data-fast-apply-path="${escapeHtml(snapshot.path)}" type="button">${t("fastApply.acceptFile")}</button>
      <button data-fast-apply-action="revert-file" data-fast-apply-session="${sessionId}" data-fast-apply-path="${escapeHtml(snapshot.path)}" type="button">${t("fastApply.revertFile")}</button>
    </article>
  `;
}

export function renderV3Controls(
  godModeActive: boolean,
  godModeExpiresAt: string | null,
  hasGodModeAccess: boolean,
  multiplayerRoom: MultiplayerRoom | null,
): string {
  const godModeLabel = godModeActive ? t("godMode.active") : t("godMode.inactive");
  return `
    <section class="v3-panel">
      <h2>${t("godMode.panel")}</h2>
      <button id="god-mode-toggle" class="${godModeActive ? "danger active" : "danger"} ${hasGodModeAccess ? "" : "locked"}" type="button" aria-disabled="${hasGodModeAccess ? "false" : "true"}">
        ${hasGodModeAccess ? "" : "Locked - "}${godModeLabel}
      </button>
      <button id="open-live-preview-button" type="button">${t("preview.open")}</button>
      <button id="join-multiplayer-button" type="button">${multiplayerRoom ? t("multiplayer.leave") : t("multiplayer.join")}</button>
      <button id="shipper-run-button" type="button">${t("shipper.run")}</button>
      <small>${godModeActive ? `${t("godMode.expires")} ${godModeExpiresAt ?? ""}` : t("godMode.hint")}</small>
    </section>
  `;
}

export function renderPreviewStatus(previewConfig: PreviewConfig | null): string {
  return `
    <section class="v3-panel">
      <h2>${t("preview.title")}</h2>
      <p>${previewConfig ? `${previewConfig.framework} ${t("preview.attached")} ${previewConfig.url}` : t("preview.idle")}</p>
    </section>
  `;
}

export function renderShipperStatus(deployState: DeployState | null): string {
  return `
    <section class="v3-panel">
      <h2>${t("shipper.title")}</h2>
      <p>${deployState ? `${deployState.provider}: ${deployState.status}` : t("shipper.ready")}</p>
      ${deployState?.url ? `<a href="${deployState.url}" target="_blank" rel="noreferrer">${deployState.url}</a>` : ""}
    </section>
  `;
}

export function renderMultiplayerStatus(multiplayerRoom: MultiplayerRoom | null): string {
  return `
    <section class="v3-panel">
      <h2>${t("multiplayer.title")}</h2>
      <p>${multiplayerRoom ? `${multiplayerRoom.name} - ${multiplayerRoom.activeUsers.length} ${t("multiplayer.collaborators")}` : t("multiplayer.offline")}</p>
    </section>
  `;
}

export function renderKanbanView(kanbanTasks: KanbanTask[]): string {
  return `
    <section class="kanban-view" aria-label="${t("kanban.aria")}">
      <header>
        <div>
          <span>${t("kanban.eyebrow")}</span>
          <h2>${t("kanban.title")}</h2>
        </div>
        <button id="new-kanban-task-button" type="button">${t("kanban.newTask")}</button>
      </header>
      ${kanbanTasks.length === 0 ? renderEmptyState({
        icon: "📋",
        title: "No tasks yet",
        description: "Create your first task to start tracking work on your Kanban board.",
        iconVariant: "warning",
        panel: true,
        action: { label: "Create first task", id: "kanban-new-task-button-empty", variant: "primary" },
      }) : `
        <div class="kanban-columns">
          ${kanbanColumns
            .map(
              (column) => `<section class="kanban-column" data-kanban-column="${column.id}">
                <h3>${getKanbanColumnTitle(column)}</h3>
                ${kanbanTasks
                  .filter((task) => task.column === column.id)
                  .map(renderKanbanTask)
                  .join("")}
              </section>`,
            )
            .join("")}
        </div>
      `}
    </section>
  `;
}

export function renderKanbanTask(task: KanbanTask): string {
  return `
    <article class="kanban-task ${task.priority}" draggable="true" data-task-id="${task.id}">
      <strong>${escapeHtml(task.title)}</strong>
      <p>${escapeHtml(task.description)}</p>
      <footer>
        <span>${task.priority}</span>
        ${task.assignedAgent ? `<span>${task.assignedAgent}</span>` : ""}
        ${task.creditsUsed ? `<span>${task.creditsUsed} ${t("kanban.credits")}</span>` : ""}
      </footer>
      ${
        task.column === "todo" || task.column === "in-progress"
          ? `<button data-task-action="send-ai" data-task-id="${task.id}" type="button">${t("kanban.sendAi")}</button>`
          : task.column === "review"
            ? `<button data-task-action="review" data-task-id="${task.id}" type="button">${t("kanban.reviewChanges")}</button>`
            : ""
      }
    </article>
  `;
}

export function getKanbanColumnTitle(column: { id: KanbanColumn; title: string }): string {
  if (column.id === "todo") return t("kanban.columns.todo");
  if (column.id === "in-progress") return t("kanban.columns.inProgress");
  if (column.id === "ai-builder") return t("kanban.columns.aiBuilder");
  if (column.id === "review") return t("kanban.columns.review");
  if (column.id === "done") return t("kanban.columns.done");
  return column.title;
}

function buildFileTree(result: RepoScanResult, gitStatuses?: GitStatusMap): FileTreeNode[] {
  return result.files.slice(0, 10).map((file) => ({
    id: file.path,
    name: file.path.split("/").pop() ?? file.path,
    path: file.path,
    kind: "file" as const,
    extension: file.extension,
    type: file.type,
    gitStatus: gitStatuses?.get(file.path) ?? "unchanged",
  }));
}


