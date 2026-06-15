import type { TourStep, TourState } from "./tour.types.js";

const OVERLAY_ID = "tour-overlay";
const SPOTLIGHT_ID = "tour-spotlight";
const TOOLTIP_ID = "tour-tooltip";

export interface RendererDependencies {
  onShowStep?: (step: TourStep, element: HTMLElement) => void | Promise<void>;
  onStepClick?: (stepId: string, direction: "prev" | "next") => void;
  onSkip?: () => void;
  onFinish?: () => void;
}

export function createOverlay(): void {
  if (document.getElementById(OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "presentation");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = getOverlayStyle();
  document.body.appendChild(overlay);
}

export function destroyOverlay(): void {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
}

export function createSpotlight(target: HTMLElement): void {
  let spot = document.getElementById(SPOTLIGHT_ID) as HTMLElement | null;
  if (!spot) {
    spot = document.createElement("div");
    spot.id = SPOTLIGHT_ID;
    spot.style.cssText = getSpotlightBaseStyle();
    document.body.appendChild(spot);
  }
  const rect = target.getBoundingClientRect();
  const padding = 8;
  spot.style.top = `${rect.top - padding + window.scrollY}px`;
  spot.style.left = `${rect.left - padding + window.scrollX}px`;
  spot.style.width = `${rect.width + padding * 2}px`;
  spot.style.height = `${rect.height + padding * 2}px`;
  spot.style.opacity = "1";
}

export function destroySpotlight(): void {
  const spot = document.getElementById(SPOTLIGHT_ID);
  if (spot) spot.remove();
}

export function createTooltip(
  step: TourStep,
  index: number,
  total: number,
  deps: RendererDependencies,
): void {
  destroyTooltip();
  const tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.setAttribute("role", "dialog");
  tooltip.setAttribute("aria-labelledby", "tour-title");
  tooltip.setAttribute("aria-describedby", "tour-content");
  tooltip.style.cssText = getTooltipBaseStyle();

  const card = buildTooltipCard(step, index, total, deps);
  tooltip.appendChild(card);
  document.body.appendChild(tooltip);

  trapFocus(tooltip);

  const target = document.querySelector(step.target) as HTMLElement | null;
  if (target) {
    positionTooltip(tooltip, target, step.placement);
  }

  const nextBtn = tooltip.querySelector<HTMLElement>("#tour-btn-next");
  nextBtn?.focus();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      tooltip.style.opacity = "1";
      tooltip.style.transform = "translateY(0)";
    });
  });
}

export function destroyTooltip(): void {
  const tip = document.getElementById(TOOLTIP_ID);
  if (tip) tip.remove();
}

function buildTooltipCard(
  step: TourStep,
  index: number,
  total: number,
  deps: RendererDependencies,
): HTMLElement {
  const card = document.createElement("div");
  card.style.cssText = getCardStyle();

  const title = document.createElement("h3");
  title.id = "tour-title";
  title.textContent = step.title;
  title.style.cssText = getTitleStyle();

  const content = document.createElement("p");
  content.id = "tour-content";
  content.textContent = step.content;
  content.style.cssText = getContentStyle();

  const progressContainer = document.createElement("div");
  progressContainer.style.cssText = "display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;";
  const progressBar = document.createElement("div");
  progressBar.style.cssText = "flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;";
  const progressFill = document.createElement("div");
  progressFill.style.cssText = `width:${((index + 1) / total) * 100}%;height:100%;background:#a855f7;border-radius:2px;transition:width 0.3s ease;`;
  progressBar.appendChild(progressFill);
  const stepLabel = document.createElement("span");
  stepLabel.style.cssText = "font-size:0.75rem;color:#a1a1aa;white-space:nowrap;";
  stepLabel.textContent = `${index + 1} / ${total}`;
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(stepLabel);

  card.appendChild(title);
  card.appendChild(content);
  const hr = document.createElement("hr");
  hr.style.cssText = "border:0;border-top:1px solid rgba(255,255,255,0.08);margin:0.75rem 0;";
  card.appendChild(hr);
  card.appendChild(progressContainer);
  card.appendChild(buildButtons(step, index, total, deps));

  return card;
}

function buildButtons(
  _step: TourStep,
  index: number,
  total: number,
  deps: RendererDependencies,
): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;";

  const left = document.createElement("div");
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.textContent = "Skip Tour";
  skipBtn.style.cssText = getSkipButtonStyle();
  skipBtn.addEventListener("click", () => {
    deps.onSkip?.();
  });
  left.appendChild(skipBtn);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;gap:0.5rem;align-items:center;";

  if (index > 0) {
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.textContent = "Prev";
    prevBtn.style.cssText = getNavButtonStyle(false);
    prevBtn.addEventListener("click", () => deps.onStepClick?.(_step.id, "prev"));
    right.appendChild(prevBtn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.id = "tour-btn-next";
  nextBtn.type = "button";
  nextBtn.textContent = index < total - 1 ? "Next" : "Finish";
  nextBtn.style.cssText = getPrimaryButtonStyle();
  nextBtn.addEventListener("click", () => {
    if (index < total - 1) {
      deps.onStepClick?.(_step.id, "next");
    } else {
      deps.onFinish?.();
    }
  });
  right.appendChild(nextBtn);

  container.appendChild(left);
  container.appendChild(right);
  return container;
}

function positionTooltip(
  tooltip: HTMLElement,
  target: HTMLElement,
  placement: TourStep["placement"],
): void {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 16;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = targetRect.bottom + gap + window.scrollY;
      left = targetRect.left + window.scrollX;
      break;
    case "top":
      top = targetRect.top - tooltipRect.height - gap + window.scrollY;
      left = targetRect.left + window.scrollX;
      break;
    case "left":
      top = targetRect.top + window.scrollY;
      left = targetRect.left - tooltipRect.width - gap + window.scrollX;
      break;
    case "right":
      top = targetRect.top + window.scrollY;
      left = targetRect.right + gap + window.scrollX;
      break;
    case "center":
      top = window.scrollY + window.innerHeight / 2 - tooltipRect.height / 2;
      left = window.scrollX + window.innerWidth / 2 - tooltipRect.width / 2;
      break;
  }

  const maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - 16;
  const maxTop = window.scrollY + window.innerHeight - tooltipRect.height - 16;
  left = Math.max(16, Math.min(left, maxLeft));
  top = Math.max(16, Math.min(top, maxTop));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function trapFocus(container: HTMLElement): void {
  const focusable = container.querySelectorAll<HTMLElement>(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  container.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  });
}

function getOverlayStyle(): string {
  return "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9998;pointer-events:auto;backdrop-filter:blur(2px);transition:opacity 0.3s ease;";
}

function getSpotlightBaseStyle(): string {
  return "position:absolute;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.55);pointer-events:none;transition:all 0.3s ease;opacity:0;z-index:9999;";
}

function getTooltipBaseStyle(): string {
  return "position:absolute;z-index:10000;opacity:0;transform:translateY(8px);transition:opacity 0.3s ease,transform 0.3s ease;max-width:400px;width:calc(100% - 32px);";
}

function getCardStyle(): string {
  return "background:rgba(24,24,27,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.25rem;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.4);backdrop-filter:blur(12px);";
}

function getTitleStyle(): string {
  return "margin:0 0 0.5rem;font-size:1rem;font-weight:600;color:#fafafa;";
}

function getContentStyle(): string {
  return "margin:0 0 1rem;font-size:0.875rem;line-height:1.5;color:#d4d4d8;";
}

function getPrimaryButtonStyle(): string {
  return "background:#a855f7;color:#fff;border:none;border-radius:0.5rem;padding:0.5rem 1.25rem;font-size:0.875rem;font-weight:500;cursor:pointer;transition:background 0.2s ease;";
}

function getNavButtonStyle(_isNext: boolean): string {
  return "background:rgba(255,255,255,0.08);color:#fafafa;border:1px solid rgba(255,255,255,0.08);border-radius:0.5rem;padding:0.5rem 1rem;font-size:0.875rem;cursor:pointer;transition:background 0.2s ease;";
}

function getSkipButtonStyle(): string {
  return "background:transparent;color:#a1a1aa;border:none;font-size:0.875rem;cursor:pointer;padding:0.25rem;text-decoration:underline;";
}
