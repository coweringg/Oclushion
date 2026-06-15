import { i18n } from "./i18n";

export function t(key: string, options?: Record<string, unknown>): string {
  const value = i18n.t(key, options);
  return typeof value === "string" ? value : String(value);
}

export function translateUI(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key) {
      element.textContent = t(key);
    }
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    if (key) {
      element.placeholder = t(key);
    }
  });

  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((element) => {
    const key = element.getAttribute("data-i18n-title");
    if (key) {
      element.title = t(key);
    }
  });

  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    const key = element.getAttribute("data-i18n-aria-label");
    if (key) {
      element.setAttribute("aria-label", t(key));
    }
  });
}
