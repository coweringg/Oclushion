import { findPromptElement, matchSupportedSite } from "@oclushion/browser-protect";

import type { ProtectionRequest, ProtectionResponse } from "./messages.js";

const host = window.location.hostname;
const site = matchSupportedSite(host);

if (site) {
  document.addEventListener("submit", (event) => {
    void protectCurrentPrompt(event, "browser_prompt_submit");
  }, true);
  document.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text") ?? "";
    if (text) {
      void protectText(event, text, "browser_paste", "paste");
    }
  }, true);
}

async function protectCurrentPrompt(event: Event, action: ProtectionRequest["action"]) {
  const element = findPromptElement(document, host);
  if (!element) {
    return;
  }
  const text = readElementText(element);
  if (!text.trim()) {
    return;
  }
  await protectText(event, text, action, selectorFor(element), element);
}

async function protectText(
  event: Event,
  text: string,
  action: ProtectionRequest["action"],
  selector: string,
  element?: HTMLElement,
) {
  const response = (await chrome.runtime.sendMessage({
    type: "SANO_BROWSER_PROTECT",
    action,
    text,
    host,
    selector,
  } satisfies ProtectionRequest)) as ProtectionResponse;

  if (response.type !== "SANO_BROWSER_PROTECT_RESULT") {
    return;
  }
  if (response.decision.effect === "TOKENIZE") {
    event.preventDefault();
    event.stopPropagation();
    if (element) {
      writeElementText(element, response.decision.sanitizedText);
    }
    showBanner("Sano tokenizo datos sensibles antes del envio.");
  } else if (response.decision.effect === "BLOCK" || response.decision.effect === "REQUIRE_APPROVAL") {
    event.preventDefault();
    event.stopPropagation();
    showBanner("Sano bloqueo este envio por politica de seguridad.");
  }
}

function readElementText(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return element.textContent ?? "";
}

function writeElementText(element: HTMLElement, text: string) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  element.textContent = text;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
}

function selectorFor(element: HTMLElement) {
  if (element.id) return `#${element.id}`;
  return element.tagName.toLowerCase();
}

function showBanner(message: string) {
  const existing = document.getElementById("sano-browser-protect-banner");
  existing?.remove();
  const banner = document.createElement("div");
  banner.id = "sano-browser-protect-banner";
  banner.textContent = message;
  banner.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "right:16px",
    "bottom:16px",
    "max-width:360px",
    "padding:12px 14px",
    "border:1px solid rgba(178,118,255,.55)",
    "border-radius:14px",
    "background:#090013",
    "color:#f8f3ff",
    "font:13px system-ui,sans-serif",
    "box-shadow:0 18px 48px rgba(122,54,255,.35)",
  ].join(";");
  document.documentElement.append(banner);
  window.setTimeout(() => banner.remove(), 4500);
}
