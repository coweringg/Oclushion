const SPINNER_CONTAINER_ID = "ocl-progress-indicators";

export type ProgressOptions = {
  message?: string;
  type?: "spinner" | "bar";
  percent?: number;
  autoDismiss?: number;
};

function getContainer(): HTMLElement {
  let el = document.getElementById(SPINNER_CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = SPINNER_CONTAINER_ID;
    el.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:7000;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none";
    document.body.appendChild(el);
  }
  return el;
}

export function showProgress(opts: ProgressOptions): string {
  const id = `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const container = getContainer();

  const el = document.createElement("div");
  el.id = id;
  el.style.cssText = `
    pointer-events:auto;
    background:rgba(14,23,36,0.92);
    border:1px solid rgba(139,155,181,0.15);
    border-radius:8px;
    padding:12px 18px;
    display:flex;
    align-items:center;
    gap:12px;
    box-shadow:0 8px 24px rgba(0,0,0,0.3);
    animation:ocl-prog-in 0.2s ease;
  `;

  if (opts.type === "bar") {
    const pct = Math.min(100, Math.max(0, opts.percent ?? 0));
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;min-width:200px;">
        ${opts.message ? `<div style="font-size:12px;color:#d1d5db;">${escapeHtml(opts.message)}</div>` : ""}
        <div style="height:4px;background:rgba(139,155,181,0.1);border-radius:2px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#7c3aed,#a78bfa);border-radius:2px;transition:width 0.3s ease;"></div>
        </div>
        <div style="font-size:11px;color:#6b7280;text-align:right;">${pct}%</div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="ocl-spinner" style="width:18px;height:18px;border:2px solid rgba(139,155,181,0.12);border-top-color:#7c3aed;border-radius:50%;animation:ocl-spin 0.7s linear infinite;flex-shrink:0;"></div>
      ${opts.message ? `<span style="font-size:13px;color:#d1d5db;">${escapeHtml(opts.message)}</span>` : ""}
    `;
  }

  container.appendChild(el);

  if (opts.autoDismiss && opts.autoDismiss > 0) {
    setTimeout(() => dismissProgress(id), opts.autoDismiss);
  }

  return id;
}

export function updateProgress(id: string, percent: number, message?: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const pct = Math.min(100, Math.max(0, percent));
  const fill = el.querySelector<HTMLElement>("div[style*='width']");
  const pctLabel = el.querySelector<HTMLElement>("div[style*='text-align:right']");
  const msgEl = el.querySelector<HTMLElement>("div[style*='font-size:12px;color:#d1d5db']");
  if (fill) fill.style.width = `${pct}%`;
  if (pctLabel) pctLabel.textContent = `${pct}%`;
  if (msgEl && message) msgEl.textContent = escapeHtml(message);
}

export function dismissProgress(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transition = "opacity 0.2s ease, transform 0.2s ease";
  el.style.opacity = "0";
  el.style.transform = "translateY(-8px)";
  setTimeout(() => el.remove(), 200);
}

export function dismissAllProgress(): void {
  const container = document.getElementById(SPINNER_CONTAINER_ID);
  if (container) container.innerHTML = "";
}

function ensureStyles(): void {
  if (typeof document === "undefined" || document.getElementById("ocl-prog-styles")) return;
  const style = document.createElement("style");
  style.id = "ocl-prog-styles";
  style.textContent = `
    @keyframes ocl-prog-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ocl-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}
ensureStyles();

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
