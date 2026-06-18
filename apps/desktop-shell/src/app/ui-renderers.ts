import { renderEmptyState } from "../ui/empty-state";
import type { FileTreeNode, RepoScanResult, FileScanType } from "../repo-scanner";
import type { PackedRepositoryContext } from "../context.service";
import type { SafeDiffProposal } from "../safe-diff.service";
import type { MarketplaceSnapshot, SuggestedSkill, InstallationProgress, MarketplaceSkillView } from "../marketplace/marketplace.types";
import type { MarketplaceSearchResult } from "../marketplace/marketplace-search.service";
import type { EnterpriseSkill } from "../types/enterprise-registry";
import type { InstalledSkillpack } from "../types/skillpack";
import type { SkillpackSnapshot } from "../skillpacks/skillpack.manager";
import type { AuditEvent, AuditSnapshot } from "../audit.service";
import type { OrchestratorSnapshot } from "../agents/types";
import type { KanbanTask, KanbanColumn } from "../kanban/kanban.types";
import type { FastApplySession } from "../fast-apply/fast-apply.types";
import type { FileSnapshot } from "../fast-apply/fast-apply.types";
import type { PreviewConfig } from "../preview/preview.types";
import type { DeployState } from "../shipper/shipper.types";
import type { MultiplayerRoom } from "../multiplayer/multiplayer.types";
import type { SessionUsageSnapshot } from "../billing/session-usage.service";
import type { EntitlementFeature } from "../billing/entitlements.types";
import type { OclushionSession } from "../auth.service";
import type { AppState } from "./state-manager";
import type { EditorFile } from "../editor/editor.types";
import type { GitStatusMap } from "../editor/git-status.service";
import type { FileDiff } from "../editor/undo-redo.service";
import { kanbanColumns } from "../kanban/kanban.types";
import { workProfiles } from "../marketplace/marketplace.service";
import { t } from "../i18n/translate";
import { escapeHtml, formatTokenCount, formatAuditType } from "../ui/utils/format";
import { BreadcrumbsService } from "../editor/breadcrumbs.service";

export function renderProfiles(
  installedSkillpacks: InstalledSkillpack[],
  getActiveSkillpack: () => { id: string; name: string },
): string {
  return installedSkillpacks
    .map(
      ({ skillpack, state }) => `
        <button class="profile-card ${state}" type="button" data-skillpack-id="${skillpack.id}">
          <span class="profile-dot"></span>
          <span>${skillpack.name}</span>
          <span class="profile-badge">${state === "active" ? t("common.active") : t("common.installed")}</span>
        </button>
      `,
    )
    .join("");
}

export function renderActiveWorkspaceSummary(
  activeSkillpack: { name: string },
  installedCount: number,
): string {
  return `
    <article class="workspace-active-card">
      <div>
        <span class="profile-dot"></span>
        <div>
          <strong>${escapeHtml(activeSkillpack.name)}</strong>
          <small>${t("workspace.activeProfile", { count: installedCount })}</small>
        </div>
      </div>
      <span class="profile-badge">${t("common.active")}</span>
    </article>
  `;
}

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

export function renderSidebarSanoShield(): string {
  return `
    <article class="sidebar-shield-card">
      <div>
        <strong>${t("privacy.title")}</strong>
        <p>${t("privacy.description")} <span>${t("common.enabled")}</span></p>
        <small>${t("privacy.details")}</small>
      </div>
      <button type="button">></button>
    </article>
  `;
}

export function renderBestRightRail(
  usage: SessionUsageSnapshot,
  sessionSpend: number,
  selectedModel: string,
  agentSnapshot?: { tasks: Array<{ status: string; role: string; description: string }>; totalCreditsUsed: number },
  auditSnapshot?: { events: Array<{ type: string; summary: string; timestamp: number }> },
): string {
  const agentTasks = agentSnapshot?.tasks ?? [];
  const recentEvents = auditSnapshot?.events.slice(-5).reverse() ?? [];

  return `
    <div id="chat-sidebar-root" hidden></div>
    <div class="chat-main-column best-right-rail">
      <div id="repo-intelligence-root"></div>
      <header class="right-tabs">
        <button class="active" type="button">${t("rightPanel.aiWorkspace")}</button>
        <button type="button">${t("rightPanel.context")}</button>
      </header>

      <div id="agent-swarm-root"></div>

      <label class="field hidden-control">
        <span>${t("chat.model")}</span>
        <select id="model-selector" aria-label="${t("chat.modelSelector")}">
          <option value="gpt-5.5">GPT-5.5</option>
          <option value="gpt-5.4-mini">GPT-5.4 mini</option>
          <option value="claude-opus-4-8">Claude Opus 4.8</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="ollama/llama3">Ollama (Local)</option>
          <option value="lmstudio/local">LM Studio (Local)</option>
          <option value="custom">${t("chat.customModel")}</option>
        </select>
        <input id="custom-model-input" type="text" placeholder="${t("chat.customModelPlaceholder")}" />
      </label>
      <footer class="ocl-chat-box">
        <div id="chat-thread" class="chat-thread" aria-live="polite"></div>
        <div class="ocl-chat-input-wrapper">
          <input id="chat-input" type="text" placeholder="✍️ Send a message or command..." />
          <button id="chat-send-button" type="button" class="ocl-chat-send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
        
        <div class="ocl-token-metrics">
          <div class="ocl-token-header">
            <span>Context Window</span>
            <span>${formatTokenCount(usage.tokensSent || 0)} / 2.0M</span>
          </div>
          <div class="ocl-token-bar">
            <div class="ocl-token-fill" style="width: ${Math.min(100, ((usage.tokensSent || 0) / 2000000) * 100)}%; background-color: ${((usage.tokensSent || 0) / 2000000) > 0.8 ? 'var(--color-danger)' : ((usage.tokensSent || 0) / 2000000) > 0.5 ? 'var(--color-warning)' : 'var(--color-success)'}"></div>
          </div>
        </div>
      </footer>
    </div>
  `;
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

export function renderEditorTabs(
  openFiles: ReadonlyArray<EditorFile>,
  activeFilePath: string | null,
): string {
  if (openFiles.length === 0) {
    return `<nav class="tabs" aria-label="${t("workspace.openFiles")}"><span class="tab-empty">${t("editor.noFilesOpen")}</span></nav>`;
  }

  const tabs = openFiles
    .map((file) => {
      const isActive = file.path === activeFilePath;
      const fileName = file.path.split("/").pop() ?? file.path;
      const ext = fileName.split(".").pop()?.toUpperCase() ?? "";
      const modifiedIndicator = file.modified ? " \u25CF" : "";

      return `
        <button class="tab ${isActive ? "active" : ""}" data-tab-path="${escapeHtml(file.path)}" type="button" draggable="true">
          <span class="tab-icon">${escapeHtml(ext)}</span>
          <span class="tab-name">${escapeHtml(fileName)}</span>
          ${modifiedIndicator ? `<span class="tab-modified">${modifiedIndicator}</span>` : ""}
        </button>
      `;
    })
    .join("");

  return `<nav class="tabs" aria-label="${t("workspace.openFiles")}">${tabs}</nav>`;
}

export function renderBreadcrumbs(activeFilePath: string | null): string {
  const service = new BreadcrumbsService();
  const items = service.parse(activeFilePath);
  return service.render(items);
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

export function renderRepoTools(): string {
  const repoTools = [
    ["RG", t("safeDiff.title")],
    ["CX", t("repoIntel.contextLoad")],
    ["TO", t("fastApply.title")],
    ["SD", t("safeDiff.title")],
    ["DA", t("repoIntel.title")],
    ["DG", t("repoIntel.summary")],
  ];
  return repoTools
    .map(
      ([icon, label], index) => `
        <button class="tool-card ${index === 3 ? "selected" : ""}" type="button">
          <span>${icon}</span>
          <strong>${label}</strong>
        </button>
      `,
    )
    .join("");
}

export function renderProjectChecks(): string {
  const projectChecks = [
    t("repoIntel.title"),
    t("repoIntel.contextLoad"),
    t("privacy.title"),
    t("safeDiff.title"),
  ];
  return projectChecks
    .map(
      (check) => `
        <li>
          <span class="check-dot"></span>
          <span>${check}</span>
        </li>
      `,
    )
    .join("");
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

export function renderMarketplaceOverlay(
  marketplaceOpen: boolean,
  onboardingOpen: boolean,
  suggestedSkill: SuggestedSkill | null,
  marketplaceTab: "skills" | "tools" | "enterprise",
  marketplaceSnapshot: MarketplaceSnapshot,
  marketplaceDownloads: Set<string>,
  marketplaceSearchQuery?: string,
  enterpriseSkills?: MarketplaceSkillView[],
  searchResults?: MarketplaceSearchResult[],
  filterTier?: string,
  sort?: string,
): string {
  if (!marketplaceOpen && !onboardingOpen && !suggestedSkill) {
    return "";
  }
  if (suggestedSkill) {
    return renderSuggestedSkillModal(suggestedSkill);
  }
  if (onboardingOpen) {
    return renderOnboardingOverlay();
  }
  const query = (marketplaceSearchQuery ?? "").toLowerCase().trim();
  const resultMap = new Map(searchResults?.map((r) => [r.id, r]));

  const hasUpdates =
    marketplaceSnapshot.skills.some((skill) => skill.installState === "update_available") ||
    marketplaceSnapshot.tools.some((tool) => tool.installState === "update_available");
  const hasEnterpriseSkills = enterpriseSkills && enterpriseSkills.length > 0;
  const filteredEnterprise = hasEnterpriseSkills
    ? (query || filterTier
        ? enterpriseSkills!.filter((skill) => {
            if (query && !skill.name.toLowerCase().includes(query) && !skill.description.toLowerCase().includes(query)) return false;
            if (filterTier && skill.tier !== filterTier) return false;
            return true;
          })
        : enterpriseSkills!)
    : [];
  const filteredPublic = query || filterTier
    ? marketplaceSnapshot.skills.filter((skill) => {
        const hasResult = !query || resultMap.has(skill.id);
        const matchesTier = !filterTier || skill.tier === filterTier;
        return hasResult && matchesTier;
      })
    : marketplaceSnapshot.skills;
  const sortedPublic = sort && sort !== "relevance"
    ? [...filteredPublic].sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "newest") return b.version.localeCompare(a.version);
        if (sort === "popular") return b.description.length - a.description.length;
        return 0;
      })
    : query ? filteredPublic.sort((a, b) => (resultMap.get(b.id)?.score ?? 0) - (resultMap.get(a.id)?.score ?? 0)) : filteredPublic;

  const enterpriseItems = filteredEnterprise.length
    ? filteredEnterprise.map((skill) => renderMarketplaceSkillCard(skill, marketplaceDownloads, resultMap.get(skill.id)?.matches)).join("")
    : hasEnterpriseSkills && query
      ? `<article class="marketplace-card"><h3>No results</h3><p>No enterprise skills match "${escapeHtml(query)}"</p></article>`
      : "";
  const publicItems = sortedPublic.length
    ? sortedPublic.map((skill) => renderMarketplaceSkillCard(skill, marketplaceDownloads, resultMap.get(skill.id)?.matches)).join("")
    : query && marketplaceTab === "skills"
      ? `<article class="marketplace-card"><h3>No results</h3><p>No skills match "${escapeHtml(query)}"</p></article>`
      : "";
  const activeItems =
    marketplaceTab === "skills"
      ? [
          ...(filteredEnterprise.length ? [
            `<header class="marketplace-section-header"><h3>Enterprise Skills</h3></header>`,
            enterpriseItems,
            `<header class="marketplace-section-header"><h3>Public Marketplace</h3></header>`,
          ] : []),
          ...(publicItems || (query ? [] : marketplaceSnapshot.skills.map((skill) => renderMarketplaceSkillCard(skill, marketplaceDownloads)))),
        ].join("")
      : marketplaceTab === "enterprise"
        ? [
            `<header class="marketplace-section-header"><h3>Enterprise Skills</h3><button id="enterprise-manage-button" class="marketplace-action secondary" type="button">${t("common.manage")}</button></header>`,
            enterpriseItems || (!hasEnterpriseSkills ? `<article class="marketplace-card"><h3>${t("marketplace.catalogUnavailable")}</h3><p>${t("marketplace.catalogUnavailableHint")}</p></article>` : ""),
          ].join("")
        : marketplaceSnapshot.tools.map((tool) => renderMarketplaceToolCard(tool, marketplaceDownloads)).join("");
  return `
    <section id="marketplace-overlay" class="marketplace-overlay" role="dialog" aria-modal="true" aria-label="${t("marketplace.aria")}">
      <div class="marketplace-panel">
        <header>
          <div>
            <span>${t("marketplace.eyebrow")}</span>
            <h2>${t("marketplace.title")}</h2>
            <p>${t("marketplace.description")}</p>
          </div>
          <div class="marketplace-header-actions">
            <button id="marketplace-update-all-button" type="button" ${hasUpdates ? "" : "disabled"}>${t("common.updateAll")}</button>
            <button id="marketplace-close-button" type="button" aria-label="${t("marketplace.close")}">${t("common.close")}</button>
          </div>
        </header>
        <nav class="marketplace-tabs" aria-label="${t("marketplace.aria")}">
          <button class="${marketplaceTab === "skills" ? "active" : ""}" type="button" data-marketplace-tab="skills">${t("marketplace.tabSkills")}</button>
          ${hasEnterpriseSkills ? `<button class="${marketplaceTab === "enterprise" ? "active" : ""}" type="button" data-marketplace-tab="enterprise">${t("marketplace.tabEnterprise")}</button>` : ""}
          <button class="${marketplaceTab === "tools" ? "active" : ""}" type="button" data-marketplace-tab="tools">${t("marketplace.tabTools")}</button>
        </nav>
        <div class="marketplace-controls">
          <label class="field marketplace-search">
            <span>${t("common.search")}</span>
            <input id="marketplace-search-input" type="search" placeholder="${t("common.search")}..." value="${escapeHtml(marketplaceSearchQuery ?? "")}" />
          </label>
          <div class="marketplace-filter-row">
            <select id="marketplace-tier-filter">
              <option value="">All Tiers</option>
              <option value="free" ${filterTier === "free" ? "selected" : ""}>Free</option>
              <option value="pro" ${filterTier === "pro" ? "selected" : ""}>Pro</option>
              <option value="enterprise" ${filterTier === "enterprise" ? "selected" : ""}>Enterprise</option>
            </select>
            <select id="marketplace-sort">
              <option value="relevance" ${sort === "relevance" || !sort ? "selected" : ""}>Relevance</option>
              <option value="name" ${sort === "name" ? "selected" : ""}>Name</option>
              <option value="newest" ${sort === "newest" ? "selected" : ""}>Newest</option>
              <option value="popular" ${sort === "popular" ? "selected" : ""}>Popular</option>
            </select>
          </div>
        </div>
        <div class="marketplace-grid">
          ${activeItems || `<article class="marketplace-card"><h3>${t("marketplace.catalogUnavailable")}</h3><p>${t("marketplace.catalogUnavailableHint")}</p></article>`}
        </div>
      </div>
    </section>
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

export function renderOnboardingOverlay(): string {
  return `
    <section id="marketplace-overlay" class="marketplace-overlay" role="dialog" aria-modal="true" aria-label="${t("onboarding.aria")}">
      <div class="marketplace-panel">
        <header>
          <div>
            <span>${t("onboarding.firstWorkspace")}</span>
            <h2>${t("onboarding.title")}</h2>
            <p>${t("onboarding.description")}</p>
          </div>
        </header>
        <div class="marketplace-grid">
          ${workProfiles
            .map(
              (profile) => `
                <article class="marketplace-card">
                  <div class="marketplace-card-top"><span>${profile.id}</span><strong>${t("onboarding.skillsCount", { count: profile.coreSkillIds.length })}</strong></div>
                  <h3>${profile.name}</h3>
                  <p>${profile.description}</p>
                  <footer><button class="marketplace-action" type="button" data-profile-id="${profile.id}">${t("onboarding.installProfile")}</button></footer>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderSuggestedSkillModal(suggestion: SuggestedSkill): string {
  const confidencePercent = Math.round(suggestion.confidence * 100);
  const keywords = suggestion.matchedKeywords.slice(0, 3).join(", ");
  return `
    <section id="marketplace-overlay" class="marketplace-overlay" role="dialog" aria-modal="true" aria-label="Suggested skill">
      <div class="marketplace-panel compact">
        <header>
          <div>
            <span class="skill-suggestion-eyebrow">${t("marketplace.suggestedSkill")}</span>
            <h2>${escapeHtml(suggestion.skill.name)}</h2>
            <p class="skill-suggestion-reason">${escapeHtml(suggestion.reason)}</p>
          </div>
        </header>
        <article class="marketplace-card skill-suggestion-card">
          <div class="skill-suggestion-meta">
            <span class="skill-suggestion-tier">${suggestion.skill.tier}</span>
            <span class="skill-suggestion-confidence">${confidencePercent}% ${t("marketplace.confidence")}</span>
          </div>
          <p>${escapeHtml(suggestion.skill.description)}</p>
          ${keywords ? `<small class="skill-suggestion-keywords">${keywords}</small>` : ""}
          <footer class="skill-suggestion-actions">
            <button class="marketplace-action" type="button" data-suggested-action="install">${t("marketplace.installAndContinue")}</button>
            <button class="marketplace-action secondary" type="button" data-suggested-action="skip">${t("marketplace.continueWithoutSkill")}</button>
          </footer>
        </article>
      </div>
    </section>
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

export function renderAuditOverlay(
  auditOpen: boolean,
  currentSession: { user?: { plan?: string } } | null,
  auditSnapshot: AuditSnapshot,
): string {
  if (!auditOpen) {
    return "";
  }
  const plan = currentSession?.user?.plan ?? "Free";
  const events = auditSnapshot.events;

  return `
    <section id="audit-overlay" class="audit-overlay" role="dialog" aria-modal="true" aria-label="${t("audit.aria")}">
      <div class="audit-panel">
        <header>
          <div>
            <span>${t("audit.eyebrow")}</span>
            <h2>${t("audit.title")}</h2>
            <p>${events.length} local event${events.length === 1 ? "" : "s"} captured</p>
          </div>
          <div class="audit-header-actions">
            <button id="audit-close-button" type="button" aria-label="${t("common.close")}">${t("common.close")}</button>
          </div>
        </header>
        <div class="audit-summary-grid">
          <article><span>${t("audit.prompts")}</span><strong>${countAuditEvents("PROMPT_SENT", auditSnapshot)}</strong></article>
          <article><span>${t("audit.approvedCode")}</span><strong>${countAuditEvents("CODE_APPROVED", auditSnapshot)}</strong></article>
          <article><span>${t("audit.rejectedCode")}</span><strong>${countAuditEvents("CODE_REJECTED", auditSnapshot)}</strong></article>
          <article><span>${t("audit.commands")}</span><strong>${countAuditEvents("COMMAND_EXECUTED", auditSnapshot)}</strong></article>
        </div>
        <div class="audit-timeline">
          ${events.length ? events.map(renderAuditEvent).join("") : renderAuditEmptyState()}
        </div>
      </div>
    </section>
  `;
}

export function renderSettingsOverlay(
  settingsOpen: boolean,
  currentSession: { user?: { plan?: string } } | null,
  usage: SessionUsageSnapshot,
  updateStatus: string,
  byokKeys: { openai?: string; anthropic?: string },
  mcpSettings: string,
  languageSwitcher: string,
): string {
  if (!settingsOpen) {
    return "";
  }
  const plan = currentSession?.user?.plan ?? "Free";
  return `
    <section id="settings-overlay" class="audit-overlay" role="dialog" aria-modal="true" aria-label="${t("settings.aria")}">
      <div class="audit-panel settings-panel">
        <header>
          <div>
            <span>${t("settings.eyebrow")}</span>
            <h2>${t("settings.title")}</h2>
            <p>${t("settings.description")}</p>
          </div>
          <button id="settings-close-button" type="button" aria-label="${t("common.close")}">${t("common.close")}</button>
        </header>
        <div class="settings-grid">
          <article class="settings-card full-span">
            <span>${t("settings.language")}</span>
            <h3>${t("settings.language")}</h3>
            ${languageSwitcher}
          </article>
          <article class="settings-card full-span">
            <span>${t("settings.updates")}</span>
            <h3>${t("settings.updater")}</h3>
            <p>${escapeHtml(updateStatus)}</p>
            ${updateStatus.indexOf(t("common.update") + " ") === 0
              ? `<button id="install-update-button" class="marketplace-action" type="button">${t("common.updaterInstall")}</button>`
              : ""}
          </article>
          <article class="settings-card">
            <span>${t("settings.optionA")}</span>
            <h3>${t("settings.byok")}</h3>
            <p>${t("settings.byokCopy")}</p>
            <label class="field">
              <span>${t("settings.openaiKey")}</span>
              <input id="openai-key-input" type="password" placeholder="sk-..." value="${escapeHtml(byokKeys.openai ?? "")}" autocomplete="off" />
            </label>
            <label class="field">
              <span>${t("settings.anthropicKey")}</span>
              <input id="anthropic-key-input" type="password" placeholder="sk-ant-..." value="${escapeHtml(byokKeys.anthropic ?? "")}" autocomplete="off" />
            </label>
            <label class="field">
              <span>${t("settings.ollamaUrl")}</span>
              <input id="ollama-url-input" type="text" placeholder="http://localhost:11434" value="${escapeHtml("")}" />
            </label>
            <button id="save-byok-button" class="marketplace-action" type="button">${t("settings.saveKeys")}</button>
          </article>
          <article class="settings-card">
            <span>${t("settings.optionB")}</span>
            <h3>${t("settings.managed")}</h3>
            <p>${t("settings.managedCopy")}</p>
            <div class="credit-balance">
              <small>${plan} plan</small>
              <strong id="credit-balance-value">${currentSession ? t("settings.creditsReady") : t("settings.creditsSignIn")}</strong>
            </div>
            <label class="field">
              <span>${t("settings.dailyLimit")}</span>
              <input id="daily-spend-limit-input" type="number" min="0" step="1" placeholder="5000" />
            </label>
            <button id="save-spend-cap-button" class="marketplace-action secondary" type="button">${t("settings.saveSpendCap")}</button>
            <button id="refresh-credits-button" class="marketplace-action secondary" type="button">${t("settings.refreshBalance")}</button>
            <button id="buy-credits-button" class="marketplace-action" type="button">${t("settings.buyCredits")}</button>
          </article>
          <article class="settings-card full-span">
            <span>${t("settings.usage")}</span>
            <h3>${t("settings.sessionUsage")}</h3>
            <div class="usage-stats-grid">
              <div class="usage-stat">
                <span>${t("settings.creditsUsedSession")}</span>
                <strong id="session-credits-used">${usage.creditsUsed}</strong>
              </div>
              <div class="usage-stat">
                <span>${t("settings.totalTokensSent")}</span>
                <strong id="session-tokens-sent">${formatTokenCount(usage.tokensSent)}</strong>
              </div>
              <div class="usage-stat">
                <span>${t("settings.promptsSent")}</span>
                <strong id="session-prompts-count">${usage.promptsCount}</strong>
              </div>
              <div class="usage-stat">
                <span>${t("settings.planRemaining")}</span>
                <strong id="plan-credits-remaining">${currentSession ? t("settings.creditsReady") : "—"}</strong>
              </div>
            </div>
          </article>
          <article class="settings-card full-span">
            <span>${t("settings.integrations")}</span>
            <h3>${t("settings.mcp")}</h3>
            <p>${t("settings.mcpCopy")}</p>
            <div class="integration-settings">
              ${mcpSettings}
            </div>
          </article>
          <article class="settings-card full-span">
            <span data-settings-tab="agents">Agents</span>
            <h3>Agent Configuration</h3>
            <p>Configure custom AI agents with YAML or the form below.</p>
            <div class="agent-config-form">
              <div class="agent-config-actions">
                <button id="export-agent-yaml-btn" type="button" class="marketplace-action secondary">Export YAML</button>
                <button id="import-agent-yaml-btn" type="button" class="marketplace-action secondary">Import YAML</button>
              </div>
              <hr />
              <label class="field">
                <span>Agent ID</span>
                <input id="agent-form-id" type="text" placeholder="my-custom-agent" />
              </label>
              <label class="field">
                <span>Name</span>
                <input id="agent-form-name" type="text" placeholder="My Custom Agent" />
              </label>
              <label class="field">
                <span>Role</span>
                <select id="agent-form-role">
                  <option value="architect">Architect</option>
                  <option value="builder" selected>Builder</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="security">Security</option>
                  <option value="qa">QA</option>
                  <option value="docs">Docs</option>
                </select>
              </label>
              <label class="field">
                <span>Model</span>
                <input id="agent-form-model" type="text" placeholder="gpt-5.4-mini" />
              </label>
              <label class="field">
                <span>System Prompt</span>
                <textarea id="agent-form-prompt" rows="4" placeholder="You are a senior engineer..."></textarea>
              </label>
              <button id="save-agent-config-btn" class="marketplace-action" type="button">Save Agent</button>
            </div>
          </article>
        </div>
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

export function renderAuditEmptyState(): string {
  return renderEmptyState({
    icon: "📝",
    title: t("audit.emptyTitle"),
    description: t("audit.emptyCopy"),
    compact: true,
    iconVariant: "muted",
  });
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

export function renderFastApplyFile(snapshot: FileSnapshot, fastApplySessions: FastApplySession[]): string {
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

export function renderCentralShell(
  kanbanOpen: boolean,
  activeRepoScan: RepoScanResult,
  collapsedDirectories: Set<string>,
  kanbanTasks: KanbanTask[],
  safeDiffProposals: SafeDiffProposal[],
  editorOpenFiles: ReadonlyArray<EditorFile> = [],
  activeFilePath: string | null = null,
): string {
  if (kanbanOpen) {
    return renderKanbanView(kanbanTasks);
  }
  return `
      <header class="topbar">
        <button id="sidebar-toggle-button" class="topbar-icon-button" type="button" title="${t("workspace.toggleSidebar")}">☰</button>
        <div class="workspace-title">
          <span class="repo-cube"></span>
          <strong>${escapeHtml(getRepoName(activeRepoScan))}</strong>
          <span>${t("common.main")}</span>
        </div>
        <div class="workspace-ready"><span></span> ${t("workspace.ready")}</div>
        <div class="topbar-actions">
          <button id="undo-button" class="topbar-icon-button" type="button" title="${t("common.undo")}">↶</button>
          <button id="redo-button" class="topbar-icon-button" type="button" title="${t("common.redo")}">↷</button>
        </div>
        <div class="window-actions" aria-hidden="true"><span></span><span></span><span></span></div>
      </header>

      ${renderEditorTabs(editorOpenFiles, activeFilePath)}

      <div class="breadcrumb" id="editor-breadcrumbs">${renderBreadcrumbs(activeFilePath)}</div>
      <div id="editor" class="code-editor" aria-label="CodeMirror editor"></div>

      <section class="bottom-panel">
        <nav class="bottom-tabs">
          <button data-bottom-tab="problems" type="button">${t("safeDiff.problems")} <span>3</span></button>
          <button data-bottom-tab="output" type="button">${t("safeDiff.output")}</button>
          <button data-bottom-tab="terminal" type="button">${t("safeDiff.terminal")}</button>
          <button data-bottom-tab="debug" type="button">${t("safeDiff.debugConsole")}</button>
          <button data-bottom-tab="safe-diff" class="active" type="button">${t("safeDiff.title")} <span></span></button>
        </nav>

        <div id="safe-diff-root" class="safe-diff">${renderSafeDiffPanel(safeDiffProposals)}</div>
      </section>
  `;
}

export function renderAppTitlebar(
  activeRepoScan: RepoScanResult,
  usage: SessionUsageSnapshot,
  currentSession: { user?: { name?: string; email?: string } } | null,
): string {
  const displayName = currentSession?.user?.name?.trim() || currentSession?.user?.email?.split("@")[0] || "Arjun Dev";
  const displayEmail = currentSession?.user?.email ?? "arjun@acme.com";
  return `
    <header class="app-titlebar" aria-label="${t("appShell.titlebarAria")}">
      <a class="app-wordmark" href="#" aria-label="${t("appShell.brandName")}">
        <span>${t("appShell.brandName")}</span>
      </a>
      <div class="app-titlebar-divider" aria-hidden="true"></div>
      <div class="titlebar-repo">
        <span class="repo-cube"></span>
        <strong id="titlebar-repo-name">${escapeHtml(getRepoName(activeRepoScan))}</strong>
      </div>
      <div class="titlebar-branch">
        <span>${t("common.branch")}</span>
        <strong>${t("common.main")}</strong>
        <small>v</small>
      </div>
      <div class="titlebar-status"><span></span> ${t("workspace.ready")} <small>i</small></div>
      <div class="titlebar-spacer"></div>
      <button id="titlebar-settings-button" class="titlebar-usage" type="button" title="${t("settings.language")}">${t("settings.creditsValue", { count: usage.creditsUsed })}</button>
      <button class="titlebar-pro" type="button">${t("common.pro")}</button>
      <button class="titlebar-icon" title="${t("common.notifications")}" type="button">${t("common.bell")}</button>
      <div class="titlebar-user">
        <span>${escapeHtml(displayName.slice(0, 1).toUpperCase())}</span>
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <small>${escapeHtml(displayEmail)}</small>
        </div>
      </div>
      <div class="window-actions" aria-hidden="true"><span></span><span></span><span></span></div>
    </header>
  `;
}

export function renderAuthOverlay(
  authMode: "login" | "register",
  authError: string,
  authSubmitting: boolean,
  authSSOMode?: "hidden" | "domain" | "waiting",
  authSSOError?: string,
): string {
  const isRegister = authMode === "register";
  const ssoMode = isRegister ? "hidden" : (authSSOMode ?? "hidden");
  return `
    <section class="desktop-auth-overlay ${isRegister ? "register-mode" : "login-mode"}" aria-modal="true" role="dialog" aria-label="${isRegister ? t("auth.registerAria") : t("auth.loginAria")}">
      <article class="desktop-auth-card">
        <header>
          <h2>${isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}</h2>
          <p>${isRegister ? t("auth.registerDescription") : t("auth.loginDescription")}</p>
        </header>
        <form id="desktop-auth-form" data-auth-form="${authMode}">
          ${isRegister ? `
            <label class="desktop-auth-field">
              <span>${t("auth.name")}</span>
              <input id="desktop-auth-name" name="name" type="text" autocomplete="name" placeholder="${t("auth.namePlaceholder")}" required />
            </label>
          ` : ""}
          <label class="desktop-auth-field">
            <span>${t("auth.email")}</span>
            <input id="desktop-auth-email" name="email" type="email" autocomplete="email" placeholder="${t("auth.emailPlaceholder")}" required />
          </label>
          <label class="desktop-auth-field">
            <span>${t("auth.password")}</span>
            <input id="desktop-auth-password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" placeholder="${t("auth.passwordPlaceholder")}" required />
          </label>
          ${isRegister ? `
            <label class="desktop-auth-field">
              <span>${t("auth.confirmPassword")}</span>
              <input id="desktop-auth-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="${t("auth.confirmPasswordPlaceholder")}" required />
            </label>
          ` : ""}
          ${isRegister ? "" : `
            <div class="desktop-auth-options">
              <label><input type="checkbox" checked /> <span>${t("auth.rememberMe")}</span></label>
              <button type="button">${t("auth.forgotPassword")}</button>
            </div>
          `}
          ${ssoMode === "hidden" && !isRegister ? `
            <button id="desktop-auth-sso-toggle" type="button" class="desktop-auth-sso-toggle">${t("auth.signInSSO")}</button>
          ` : ""}
          ${ssoMode === "domain" ? `
            <div class="desktop-auth-sso-domain">
              <label class="desktop-auth-field">
                <span>${t("auth.ssoDomain")}</span>
                <input id="desktop-auth-sso-domain-input" name="ssoDomain" type="text" placeholder="${t("auth.ssoDomainPlaceholder")}" required />
              </label>
              ${authSSOError ? `<p class="desktop-auth-error" role="alert">${escapeHtml(authSSOError)}</p>` : ""}
              <button id="desktop-auth-sso-submit" type="button" class="desktop-auth-submit">${t("auth.continueWithSSO")}</button>
              <button id="desktop-auth-sso-back" type="button" class="desktop-auth-sso-back">${t("auth.backToPassword")}</button>
            </div>
          ` : ""}
          ${ssoMode === "waiting" ? `
            <div class="desktop-auth-sso-waiting">
              <p>${t("auth.ssoWaiting")}</p>
              <div class="desktop-auth-sso-spinner"></div>
              ${authSSOError ? `<p class="desktop-auth-error" role="alert">${escapeHtml(authSSOError)}</p>` : ""}
              <button id="desktop-auth-sso-cancel" type="button" class="desktop-auth-sso-back">${t("auth.cancel")}</button>
            </div>
          ` : ""}
          ${ssoMode === "hidden" ? (authError ? `<p class="desktop-auth-error" role="alert">${escapeHtml(authError)}</p>` : "") : ""}
          ${ssoMode === "hidden" ? `
            <button class="desktop-auth-submit" type="submit" ${authSubmitting ? "disabled" : ""}>
              ${authSubmitting ? t("auth.connecting") : isRegister ? t("auth.createAccount") : t("auth.signIn")}
            </button>
          ` : ""}
        </form>
        ${isRegister ? `<p class="desktop-auth-note">${t("auth.freeForever")}</p>` : ""}
        <footer class="desktop-auth-switch">
          <span>${isRegister ? t("auth.hasAccount") : t("auth.noAccount")}</span>
          <button class="${isRegister ? "" : "active"}" type="button" data-auth-mode="${isRegister ? "login" : "register"}">${isRegister ? t("auth.switchToLogin") : t("auth.switchToRegister")}</button>
        </footer>
      </article>
    </section>
  `;
}

export function renderUpgradeModal(upgradeModalFeature: EntitlementFeature | null): string {
  if (!upgradeModalFeature) {
    return "";
  }
  const copy = getUpgradeCopy(upgradeModalFeature);
  return `
    <section class="upgrade-overlay" aria-modal="true" role="dialog" aria-label="${t("upgrade.aria")}">
      <article class="upgrade-modal">
        <button id="upgrade-modal-close" class="upgrade-close" type="button" aria-label="${t("upgrade.close")}">x</button>
        <span class="upgrade-kicker">${t("upgrade.kicker")}</span>
        <h2>${copy.title}</h2>
        <p>${copy.description}</p>
        <div class="upgrade-actions">
          <button id="upgrade-account-button" class="upgrade-primary" type="button">${t("upgrade.primary")}</button>
          <button id="upgrade-modal-later" type="button">${t("upgrade.later")}</button>
        </div>
      </article>
    </section>
  `;
}

export function getUpgradeCopy(feature: EntitlementFeature): { title: string; description: string } {
  if (feature === "hasGodMode") {
    return {
      title: t("upgrade.godTitle"),
      description: t("upgrade.godCopy"),
    };
  }
  if (feature === "hasAutoPromptEnhancer") {
    return {
      title: t("upgrade.promptTitle"),
      description: t("upgrade.promptCopy"),
    };
  }
  return {
    title: t("upgrade.voiceTitle"),
    description: t("upgrade.voiceCopy"),
  };
}

function countAuditEvents(type: AuditEvent["type"], auditSnapshot: AuditSnapshot): number {
  return auditSnapshot.events.filter((event) => event.type === type).length;
}

export function renderUndoRedoDiffOverlay(diff: FileDiff, mode: "undo" | "redo"): string {
  return `
    <div class="diff-overlay" role="dialog" aria-modal="true" data-diff-file="${escapeHtml(diff.filePath)}">
      <div class="diff-header">
        <span class="diff-title">${mode === "undo" ? "Undo" : "Redo"} changes in ${escapeHtml(diff.fileName)}</span>
        <span class="diff-stats">
          <span class="diff-added">+${diff.addedCount}</span>
          <span class="diff-removed">-${diff.removedCount}</span>
        </span>
        <button class="diff-close" type="button">✕</button>
      </div>
      <div class="diff-content">
        ${diff.lines
          .map(
            (line) => `
          <div class="diff-line diff-line-${line.type}">
            <span class="diff-line-number">${line.lineNumber || ""}</span>
            <span class="diff-line-prefix">${line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}</span>
            <span class="diff-line-content">${escapeHtml(line.content)}</span>
          </div>
        `,
          )
          .join("")}
      </div>
      <div class="diff-actions">
        <button class="diff-btn diff-btn-revert" type="button" data-diff-action="${mode}">
          ${mode === "undo" ? "Revert this change" : "Re-apply this change"}
        </button>
        <button class="diff-btn diff-btn-cancel" type="button">Cancel</button>
      </div>
    </div>
  `;
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

export function renderWelcomeOnboarding(): string {
  return `
    <div class="onboarding-backdrop" id="onboarding-backdrop">
      <div class="onboarding-card" role="dialog" aria-label="Welcome to Oclushion">
        <div class="onboarding-header">
          <div class="onboarding-logo">O</div>
          <h1>Welcome to Oclushion</h1>
          <p>Your AI-native desktop IDE. Let's get you started in 3 steps.</p>
        </div>

        <div class="onboarding-steps">
          <div class="onboarding-step" data-step="open_repo">
            <div class="onboarding-step-icon">1</div>
            <div class="onboarding-step-content">
              <h3>Open a Repository</h3>
              <p>Click the folder icon or press Ctrl+O to open your project folder.</p>
            </div>
            <span class="onboarding-step-status">${t("common.next")}</span>
          </div>

          <div class="onboarding-step" data-step="configure_api">
            <div class="onboarding-step-icon">2</div>
            <div class="onboarding-step-content">
              <h3>Configure API Key</h3>
              <p>Go to Settings and add your OpenAI or Anthropic API key.</p>
            </div>
            <span class="onboarding-step-status">${t("common.next")}</span>
          </div>

          <div class="onboarding-step" data-step="send_prompt">
            <div class="onboarding-step-icon">3</div>
            <div class="onboarding-step-content">
              <h3>Send Your First Prompt</h3>
              <p>Type a message in the chat and press Enter to start coding with AI.</p>
            </div>
            <span class="onboarding-step-status">${t("common.next")}</span>
          </div>
        </div>

        <div class="onboarding-actions">
          <button id="onboarding-skip" class="onboarding-btn-skip" type="button">Skip Tour</button>
          <button id="onboarding-start" class="onboarding-btn-start" type="button">Get Started</button>
        </div>
      </div>
    </div>
  `;
}
