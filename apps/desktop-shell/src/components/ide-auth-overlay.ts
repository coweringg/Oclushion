import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { getModel } from "../app/model-provider";
import { t } from "../i18n/translate";
import type { AppModel } from "../app/state-manager";

@customElement("ide-auth-overlay")
export class IdeAuthOverlay extends LitElement {
  private _model: AppModel = getModel();
  private _unsubs: Array<() => void> = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs = [
      this._model.subscribe("authMode", () => this.requestUpdate()),
      this._model.subscribe("authError", () => this.requestUpdate()),
      this._model.subscribe("authSubmitting", () => this.requestUpdate()),
      this._model.subscribe("authSSOMode", () => this.requestUpdate()),
      this._model.subscribe("authSSOError", () => this.requestUpdate()),
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
    const authMode = this._model.get("authMode");
    const authError = this._model.get("authError");
    const authSubmitting = this._model.get("authSubmitting");
    const authSSOMode = this._model.get("authSSOMode");
    const authSSOError = this._model.get("authSSOError");

    const isRegister = authMode === "register";
    const ssoMode = isRegister ? "hidden" : (authSSOMode ?? "hidden");

    return html`
      <section class="desktop-auth-overlay ${isRegister ? "register-mode" : "login-mode"}" aria-modal="true" role="dialog" aria-label="${isRegister ? t("auth.registerAria") : t("auth.loginAria")}">
        <article class="desktop-auth-card">
          <header class="desktop-auth-header">
            <div class="auth-logo">O</div>
            <h2>${isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}</h2>
            <p>${isRegister ? t("auth.registerDescription") : t("auth.loginDescription")}</p>
            <div class="auth-divider"></div>
          </header>
          <form id="desktop-auth-form" data-auth-form="${authMode}">
            ${isRegister ? html`
              <label class="desktop-auth-field">
                <span>${t("auth.name")}</span>
                <div class="auth-input-wrapper">
                  <input id="desktop-auth-name" name="name" type="text" autocomplete="name" placeholder="${t("auth.namePlaceholder")}" required />
                </div>
              </label>
            ` : ""}
            <label class="desktop-auth-field">
              <span>${t("auth.email")}</span>
              <div class="auth-input-wrapper">
                <span class="auth-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <input id="desktop-auth-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required />
              </div>
            </label>
            <label class="desktop-auth-field">
              <span>${t("auth.password")}</span>
              <div class="auth-input-wrapper">
                <span class="auth-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input id="desktop-auth-password" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" placeholder="••••••••••••" required />
              </div>
            </label>
            ${isRegister ? html`
              <label class="desktop-auth-field">
                <span>${t("auth.confirmPassword")}</span>
                <div class="auth-input-wrapper">
                  <input id="desktop-auth-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="${t("auth.confirmPasswordPlaceholder")}" required />
                </div>
              </label>
            ` : ""}
            ${!isRegister ? html`
              <div class="desktop-auth-options">
                <label><input type="checkbox" checked /> <span>${t("auth.rememberMe")}</span></label>
                <button type="button">${t("auth.forgotPassword")}</button>
              </div>
            ` : ""}

            ${ssoMode === "domain" ? html`
              <div class="desktop-auth-sso-domain">
                <label class="desktop-auth-field">
                  <span>${t("auth.ssoDomain")}</span>
                  <input id="desktop-auth-sso-domain-input" name="ssoDomain" type="text" placeholder="${t("auth.ssoDomainPlaceholder")}" required />
                </label>
                ${authSSOError ? html`<p class="desktop-auth-error" role="alert">${authSSOError}</p>` : ""}
                <button id="desktop-auth-sso-submit" type="button" class="desktop-auth-submit">${t("auth.continueWithSSO")}</button>
                <button id="desktop-auth-sso-back" type="button" class="desktop-auth-sso-back">${t("auth.backToPassword")}</button>
              </div>
            ` : ""}
            ${ssoMode === "waiting" ? html`
              <div class="desktop-auth-sso-waiting">
                <p>${t("auth.ssoWaiting")}</p>
                <div class="desktop-auth-sso-spinner"></div>
                ${authSSOError ? html`<p class="desktop-auth-error" role="alert">${authSSOError}</p>` : ""}
                <button id="desktop-auth-sso-cancel" type="button" class="desktop-auth-sso-back">${t("auth.cancel")}</button>
              </div>
            ` : ""}
            ${ssoMode === "hidden" ? (authError ? html`<p class="desktop-auth-error" role="alert">${authError}</p>` : "") : ""}
            ${ssoMode === "hidden" ? html`
              <button class="desktop-auth-submit" type="submit" ?disabled=${authSubmitting}>
                ${authSubmitting ? t("auth.connecting") : isRegister ? t("auth.createAccount") : t("auth.signIn")}
              </button>
            ` : ""}
          </form>

          ${ssoMode === "hidden" && !isRegister ? html`
            <div class="auth-or-divider">or</div>
            <button id="desktop-auth-sso-toggle" type="button" class="desktop-auth-sso-toggle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
              ${t("auth.signInSSO")}
            </button>
          ` : ""}

          ${isRegister ? html`<p class="desktop-auth-note">${t("auth.freeForever")}</p>` : ""}
          <footer class="desktop-auth-switch">
            <span>${isRegister ? t("auth.hasAccount") : t("auth.noAccount")}</span>
            <button class="${isRegister ? "" : "active"}" type="button" data-auth-mode="${isRegister ? "login" : "register"}">${isRegister ? t("auth.switchToLogin") : t("auth.switchToRegister")}</button>
          </footer>
        </article>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-auth-overlay": IdeAuthOverlay;
  }
}
