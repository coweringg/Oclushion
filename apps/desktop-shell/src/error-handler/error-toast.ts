import type { UserFriendlyError } from "./error-catalog";

const TOAST_CONTAINER_ID = "ocl-error-toasts";

type ToastOptions = {
  duration?: number;
  onAction?: () => void;
};

function getContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText =
      "position:fixed;bottom:16px;right:16px;z-index:6000;display:flex;flex-direction:column;gap:8px;max-width:420px;width:calc(100% - 32px);pointer-events:none";
    document.body.appendChild(container);
  }
  return container;
}

export function showErrorToast(
  error: UserFriendlyError,
  options: ToastOptions = {},
): void {
  const { duration = 6000 } = options;
  const container = getContainer();

  const toast = document.createElement("div");
  toast.setAttribute("role", "alert");
  toast.style.cssText = `
    pointer-events:auto;
    background:#1a1a2e;
    border:1px solid ${error.type === "rate_limit" ? "rgba(251,146,60,0.3)" : "rgba(239,68,68,0.3)"};
    border-radius:10px;
    padding:14px 16px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation:ocl-toast-in 0.2s ease;
    font-family:system-ui,-apple-system,sans-serif;
  `;

  toast.innerHTML = `
    <div style="display:flex;align-items:start;gap:10px;">
      <span style="flex-shrink:0;font-size:16px;margin-top:1px;">${iconForType(error.type)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#fafafa;margin-bottom:4px;">
          ${escapeHtml(error.code)} — ${escapeHtml(error.title)}
        </div>
        <div style="font-size:12px;color:#a1a1aa;line-height:1.5;margin-bottom:${error.action ? "10px" : "0"};">
          ${escapeHtml(error.explanation)}
        </div>
        ${error.action ? `
          <a href="${escapeHtml(error.action.href ?? "#")}"
             style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);border-radius:6px;color:#a78bfa;font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;transition:all 0.15s ease;">
            ${escapeHtml(error.action.label)}
          </a>
        ` : ""}
      </div>
      <button style="flex-shrink:0;background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;padding:2px;line-height:1;" aria-label="Dismiss">
        ×
      </button>
    </div>
  `;

  const dismissBtn = toast.querySelector("button");
  dismissBtn?.addEventListener("click", () => {
    dismissToast(toast);
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast: HTMLElement): void {
  toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  toast.style.opacity = "0";
  toast.style.transform = "translateX(20px)";
  setTimeout(() => toast.remove(), 200);
}

function iconForType(type: string): string {
  switch (type) {
    case "network": return "🌐";
    case "auth": return "🔐";
    case "rate_limit": return "⏳";
    case "server": return "⚠️";
    case "validation": return "📋";
    case "permission": return "🛡️";
    case "config": return "⚙️";
    default: return "❌";
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

if (typeof document !== "undefined" && !document.getElementById("ocl-toast-styles")) {
  const style = document.createElement("style");
  style.id = "ocl-toast-styles";
  style.textContent = `@keyframes ocl-toast-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`;
  document.head.appendChild(style);
}
