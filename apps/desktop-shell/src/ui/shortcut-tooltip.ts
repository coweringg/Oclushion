const TOOLTIP_ID = "ocl-shortcut-tooltip";

export function enableShortcutTooltips(): () => void {
  if (typeof document === "undefined") return () => {};

  let tooltipEl = document.createElement("div");
  tooltipEl.id = TOOLTIP_ID;
  tooltipEl.style.cssText = `
    position:fixed;z-index:8000;pointer-events:none;opacity:0;
    background:rgba(14,23,36,0.95);border:1px solid rgba(139,155,181,0.15);
    border-radius:6px;padding:6px 10px;font-size:11px;color:#d1d5db;
    font-family:system-ui,-apple-system,sans-serif;white-space:nowrap;
    transition:opacity 0.12s ease;box-shadow:0 4px 12px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(tooltipEl);

  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const show = (target: HTMLElement, text: string) => {
    if (hideTimeout) clearTimeout(hideTimeout);
    tooltipEl.textContent = text;
    const rect = target.getBoundingClientRect();
    const tipW = tooltipEl.offsetWidth;
    let left = rect.left + rect.width / 2 - tipW / 2;
    const top = rect.bottom + 6;
    left = Math.max(4, Math.min(left, window.innerWidth - tipW - 4));
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.opacity = "1";
  };

  const hide = () => {
    hideTimeout = setTimeout(() => { tooltipEl.style.opacity = "0"; }, 100);
  };

  const handler = ((e: Event) => {
    const target = e.currentTarget as HTMLElement;
    const shortcut = target.getAttribute("data-shortcut");
    if (shortcut) {
      show(target, shortcut);
    }
  }) as EventListener;

  const observer = new MutationObserver(() => {
    document.querySelectorAll("[data-shortcut]").forEach((el) => {
      if (!el.hasAttribute("data-shorttip-attached")) {
        el.setAttribute("data-shorttip-attached", "");
        el.addEventListener("mouseenter", handler);
        el.addEventListener("mouseleave", hide);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll("[data-shortcut]").forEach((el) => {
    if (!el.hasAttribute("data-shorttip-attached")) {
      el.setAttribute("data-shorttip-attached", "");
      el.addEventListener("mouseenter", handler);
      el.addEventListener("mouseleave", hide);
    }
  });

  return () => {
    observer.disconnect();
    tooltipEl.remove();
    document.querySelectorAll("[data-shorttip-attached]").forEach((el) => {
      el.removeAttribute("data-shorttip-attached");
      el.removeEventListener("mouseenter", handler);
      el.removeEventListener("mouseleave", hide);
    });
  };
}

export function formatShortcut(modifiers: string[], key: string): string {
  const isMac = navigator.userAgent.includes("Mac");
  const modKey = isMac ? "⌘" : "Ctrl";
  const modMap: Record<string, string> = {
    mod: modKey,
    shift: isMac ? "⇧" : "Shift",
    alt: isMac ? "⌥" : "Alt",
  };
  const parts = modifiers.map((m) => modMap[m] ?? m);
  parts.push(key.toUpperCase());
  return parts.join(isMac ? "" : "+");
}
