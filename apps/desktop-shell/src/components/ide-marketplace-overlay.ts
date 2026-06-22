import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import { renderMarketplaceSkillCard, renderMarketplaceToolCard } from "../app/ui-renderers";
import { workProfiles } from "../marketplace/marketplace.service";
import type { AppModel } from "../app/state-manager";
import type { MarketplaceSnapshot } from "../marketplace/marketplace.types";
import type { MarketplaceSearchResult } from "../marketplace/marketplace-search.service";

@customElement("ide-marketplace-overlay")
export class IdeMarketplaceOverlay extends LitElement {
  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  @property({ type: Array })
  searchResults: MarketplaceSearchResult[] | undefined = undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("marketplaceOpen", () => this.requestUpdate()),
      this._model.subscribe("onboardingOpen", () => this.requestUpdate()),
      this._model.subscribe("suggestedSkill", () => this.requestUpdate()),
      this._model.subscribe("marketplaceTab", () => this.requestUpdate()),
      this._model.subscribe("marketplaceSnapshot", () => this.requestUpdate()),
      this._model.subscribe("marketplaceDownloads", () => this.requestUpdate()),
      this._model.subscribe("marketplaceSearchQuery", () => this.requestUpdate()),
      this._model.subscribe("marketplaceFilterTier", () => this.requestUpdate()),
      this._model.subscribe("marketplaceSort", () => this.requestUpdate()),
      this._model.subscribe("enterpriseSkills", () => this.requestUpdate()),
    ];
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const marketplaceOpen = this._model.get("marketplaceOpen");
    const onboardingOpen = this._model.get("onboardingOpen");
    const suggestedSkill = this._model.get("suggestedSkill");

    if (!marketplaceOpen && !onboardingOpen && !suggestedSkill) {
      return html``;
    }

    if (suggestedSkill) {
      const confidencePct = Math.round(suggestedSkill.confidence * 100);
      const keywords = suggestedSkill.matchedKeywords.slice(0, 3).join(", ");
      return html`
        <section id="marketplace-overlay" class="marketplace-overlay" role="dialog" aria-modal="true" aria-label="Suggested skill">
          <div class="marketplace-panel compact">
            <header>
              <div>
                <span class="skill-suggestion-eyebrow">${t("marketplace.suggestedSkill")}</span>
                <h2>${suggestedSkill.skill.name}</h2>
                <p class="skill-suggestion-reason">${suggestedSkill.reason}</p>
              </div>
            </header>
            <article class="marketplace-card skill-suggestion-card">
              <div class="skill-suggestion-meta">
                <span class="skill-suggestion-tier">${suggestedSkill.skill.tier}</span>
                <span class="skill-suggestion-confidence">${confidencePct}% ${t("marketplace.confidence")}</span>
              </div>
              <p>${suggestedSkill.skill.description}</p>
              ${keywords ? html`<small class="skill-suggestion-keywords">${keywords}</small>` : ""}
              <footer class="skill-suggestion-actions">
                <button class="marketplace-action" type="button" data-suggested-action="install">${t("marketplace.installAndContinue")}</button>
                <button class="marketplace-action secondary" type="button" data-suggested-action="skip">${t("marketplace.continueWithoutSkill")}</button>
              </footer>
            </article>
          </div>
        </section>
      `;
    }

    if (onboardingOpen) {
      return html`
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
              ${workProfiles.map((profile) => html`
                <article class="marketplace-card">
                  <div class="marketplace-card-top"><span>${profile.id}</span><strong>${t("onboarding.skillsCount", { count: profile.coreSkillIds.length })}</strong></div>
                  <h3>${profile.name}</h3>
                  <p>${profile.description}</p>
                  <footer><button class="marketplace-action" type="button" data-profile-id="${profile.id}">${t("onboarding.installProfile")}</button></footer>
                </article>
              `)}
            </div>
          </div>
        </section>
      `;
    }

    const marketplaceTab = this._model.get("marketplaceTab");
    const marketplaceSnapshot = this._model.get("marketplaceSnapshot");
    const marketplaceDownloads = this._model.get("marketplaceDownloads");
    const marketplaceSearchQuery = this._model.get("marketplaceSearchQuery");
    const enterpriseSkills = this._model.get("enterpriseSkills");
    const searchResults = this.searchResults;
    const filterTier = this._model.get("marketplaceFilterTier");
    const sort = this._model.get("marketplaceSort");

    const query = (marketplaceSearchQuery ?? "").toLowerCase().trim();
    const resultMap = new Map(searchResults?.map((r: MarketplaceSearchResult) => [r.id, r]));

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
        ? `<article class="marketplace-card"><h3>No results</h3><p>No enterprise skills match "${query}"</p></article>`
        : "";

    const publicItems = sortedPublic.length
      ? sortedPublic.map((skill) => renderMarketplaceSkillCard(skill, marketplaceDownloads, resultMap.get(skill.id)?.matches)).join("")
      : query && marketplaceTab === "skills"
        ? `<article class="marketplace-card"><h3>No results</h3><p>No skills match "${query}"</p></article>`
        : "";

    let activeItemsHtml = "";
    if (marketplaceTab === "skills") {
      const parts: string[] = [];
      if (filteredEnterprise.length) {
        parts.push('<header class="marketplace-section-header"><h3>Enterprise Skills</h3></header>');
        parts.push(enterpriseItems);
        parts.push('<header class="marketplace-section-header"><h3>Public Marketplace</h3></header>');
      }
      if (publicItems) {
        parts.push(publicItems);
      } else if (!query) {
        marketplaceSnapshot.skills.forEach((skill) => {
          parts.push(renderMarketplaceSkillCard(skill, marketplaceDownloads));
        });
      }
      activeItemsHtml = parts.join("");
    } else if (marketplaceTab === "enterprise") {
      activeItemsHtml = [
        `<header class="marketplace-section-header"><h3>Enterprise Skills</h3><button id="enterprise-manage-button" class="marketplace-action secondary" type="button">${t("common.manage")}</button></header>`,
        enterpriseItems || (!hasEnterpriseSkills ? `<article class="marketplace-card"><h3>${t("marketplace.catalogUnavailable")}</h3><p>${t("marketplace.catalogUnavailableHint")}</p></article>` : ""),
      ].join("");
    } else {
      activeItemsHtml = marketplaceSnapshot.tools.map((tool) => renderMarketplaceToolCard(tool, marketplaceDownloads)).join("");
    }

    return html`
      <section id="marketplace-overlay" class="marketplace-overlay" role="dialog" aria-modal="true" aria-label="${t("marketplace.aria")}">
        <div class="marketplace-panel">
          <header>
            <div>
              <span>${t("marketplace.eyebrow")}</span>
              <h2>${t("marketplace.title")}</h2>
              <p>${t("marketplace.description")}</p>
            </div>
            <div class="marketplace-header-actions">
              <button id="marketplace-update-all-button" type="button" ?disabled=${!hasUpdates}>${t("common.updateAll")}</button>
              <button id="marketplace-close-button" type="button" aria-label="${t("marketplace.close")}">${t("common.close")}</button>
            </div>
          </header>
          <nav class="marketplace-tabs" aria-label="${t("marketplace.aria")}">
            <button class="${marketplaceTab === "skills" ? "active" : ""}" type="button" data-marketplace-tab="skills">${t("marketplace.tabSkills")}</button>
            ${hasEnterpriseSkills ? html`<button class="${marketplaceTab === "enterprise" ? "active" : ""}" type="button" data-marketplace-tab="enterprise">${t("marketplace.tabEnterprise")}</button>` : ""}
            <button class="${marketplaceTab === "tools" ? "active" : ""}" type="button" data-marketplace-tab="tools">${t("marketplace.tabTools")}</button>
          </nav>
          <div class="marketplace-controls">
            <label class="field marketplace-search">
              <span>${t("common.search")}</span>
              <input id="marketplace-search-input" type="search" placeholder="${t("common.search")}..." .value=${marketplaceSearchQuery ?? ""} />
            </label>
            <div class="marketplace-filter-row">
              <select id="marketplace-tier-filter">
                <option value="">All Tiers</option>
                <option value="free" ?selected=${filterTier === "free"}>Free</option>
                <option value="pro" ?selected=${filterTier === "pro"}>Pro</option>
                <option value="enterprise" ?selected=${filterTier === "enterprise"}>Enterprise</option>
              </select>
              <select id="marketplace-sort">
                <option value="relevance" ?selected=${sort === "relevance" || !sort}>Relevance</option>
                <option value="name" ?selected=${sort === "name"}>Name</option>
                <option value="newest" ?selected=${sort === "newest"}>Newest</option>
                <option value="popular" ?selected=${sort === "popular"}>Popular</option>
              </select>
            </div>
          </div>
          <div class="marketplace-grid">
            ${activeItemsHtml ? unsafeHTML(activeItemsHtml) : html`<article class="marketplace-card"><h3>${t("marketplace.catalogUnavailable")}</h3><p>${t("marketplace.catalogUnavailableHint")}</p></article>`}
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-marketplace-overlay": IdeMarketplaceOverlay;
  }
}
