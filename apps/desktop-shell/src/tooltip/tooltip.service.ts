import type { TooltipPlacement, TooltipContent, TooltipOptions } from "./tooltip.types";
import { DEFAULT_TOOLTIP_OPTIONS } from "./tooltip.types";

const TOOLTIP_CLASS = "ocl-tooltip";
const TOOLTIP_ATTR = "data-tooltip";

export class ContextualTooltipService {
  private options: TooltipOptions;
  private tooltipEl: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTarget: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(options?: Partial<TooltipOptions>) {
    this.options = { ...DEFAULT_TOOLTIP_OPTIONS, ...options };
  }

  init(root: HTMLElement = document.body): void {
    this.addListeners(root);

    this.observer = new MutationObserver(() => {
      this.addListeners(root);
    });
    this.observer.observe(root, { childList: true, subtree: true });
  }

  destroy(): void {
    this.hide();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private addListeners(root: HTMLElement): void {
    const onShow = (target: HTMLElement) => {
      const raw = target.getAttribute(TOOLTIP_ATTR);
      if (!raw) return;
      const content = this.parseContent(raw);
      this.scheduleShow(target, content);
    };

    const onHide = (target: HTMLElement) => {
      if (target === this.currentTarget) {
        this.scheduleHide();
      }
    };

    const showHandler = (e: Event) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(`[${TOOLTIP_ATTR}]`);
      if (target) onShow(target);
    };

    const hideHandler = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget || (e as FocusEvent).relatedTarget;
      if (related instanceof HTMLElement && related.closest(`.${TOOLTIP_CLASS}`)) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>(`[${TOOLTIP_ATTR}]`);
      if (target) onHide(target);
    };

    root.addEventListener("mouseenter", showHandler, true);
    root.addEventListener("mouseleave", hideHandler, true);
    root.addEventListener("focusin", showHandler, true);
    root.addEventListener("focusout", hideHandler, true);

    this.cleanupFns.push(
      () => root.removeEventListener("mouseenter", showHandler, true),
      () => root.removeEventListener("mouseleave", hideHandler, true),
      () => root.removeEventListener("focusin", showHandler, true),
      () => root.removeEventListener("focusout", hideHandler, true),
    );
  }

  private parseContent(raw: string): TooltipContent {
    const pipeIndex = raw.indexOf("|");
    if (pipeIndex > 0) {
      return {
        title: raw.slice(0, pipeIndex).trim(),
        description: raw.slice(pipeIndex + 1).trim(),
      };
    }
    return { title: "", description: raw.trim() };
  }

  private scheduleShow(target: HTMLElement, content: TooltipContent): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.showTimeout) clearTimeout(this.showTimeout);

    if (this.currentTarget === target && this.tooltipEl) {
      return;
    }

    this.showTimeout = setTimeout(() => {
      this.currentTarget = target;
      this.render(content, target);
      this.showTimeout = null;
    }, this.options.delayMs);
  }

  private scheduleHide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    this.hideTimeout = setTimeout(() => {
      this.hide();
      this.hideTimeout = null;
    }, 150);
  }

  private render(content: TooltipContent, target: HTMLElement): void {
    this.destroyTooltipElement();

    const el = document.createElement("div");
    el.className = TOOLTIP_CLASS;
    el.setAttribute("role", "tooltip");
    el.style.cssText = this.getBaseStyle();

    if (content.title) {
      const titleEl = document.createElement("strong");
      titleEl.textContent = content.title;
      titleEl.style.cssText = "display:block;font-size:0.8rem;font-weight:600;margin-bottom:0.25rem;color:#fafafa;";
      el.appendChild(titleEl);
    }

    if (content.description) {
      const descEl = document.createElement("span");
      descEl.textContent = content.description;
      descEl.style.cssText = "display:block;font-size:0.75rem;line-height:1.4;color:#d4d4d8;";
      el.appendChild(descEl);
    }

    document.body.appendChild(el);
    this.tooltipEl = el;
    this.position(el, target);

    el.addEventListener("mouseenter", () => {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    }, { once: false });

    el.addEventListener("mouseleave", () => this.scheduleHide(), { once: false });
  }

  private position(el: HTMLElement, target: HTMLElement): void {
    const targetRect = target.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const gap = 8;
    let top = 0;
    let left = 0;

    const placement = this.resolvePlacement(target);

    switch (placement) {
      case "bottom":
        top = targetRect.bottom + gap + window.scrollY;
        left = targetRect.left + window.scrollX + targetRect.width / 2 - elRect.width / 2;
        break;
      case "top":
        top = targetRect.top - elRect.height - gap + window.scrollY;
        left = targetRect.left + window.scrollX + targetRect.width / 2 - elRect.width / 2;
        break;
      case "left":
        top = targetRect.top + window.scrollY + targetRect.height / 2 - elRect.height / 2;
        left = targetRect.left - elRect.width - gap + window.scrollX;
        break;
      case "right":
        top = targetRect.top + window.scrollY + targetRect.height / 2 - elRect.height / 2;
        left = targetRect.right + gap + window.scrollX;
        break;
    }

    const maxLeft = window.scrollX + window.innerWidth - elRect.width - 16;
    const maxTop = window.scrollY + window.innerHeight - elRect.height - 16;
    left = Math.max(16, Math.min(left, maxLeft));
    top = Math.max(16, Math.min(top, maxTop));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.opacity = "1";
  }

  private resolvePlacement(target: HTMLElement): TooltipPlacement {
    const attr = target.getAttribute("data-tooltip-placement") as TooltipPlacement | null;
    if (attr && ["top", "bottom", "left", "right"].includes(attr)) return attr;
    return this.options.placement;
  }

  private hide(): void {
    this.currentTarget = null;
    this.destroyTooltipElement();
  }

  private destroyTooltipElement(): void {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }

  private getBaseStyle(): string {
    return [
      "position:fixed",
      "z-index:10001",
      "opacity:0",
      "transition:opacity 0.15s ease",
      `max-width:${this.options.maxWidth}px`,
      "background:rgba(24,24,27,0.95)",
      "border:1px solid rgba(255,255,255,0.08)",
      "border-radius:8px",
      "padding:0.5rem 0.75rem",
      "font-family:system-ui,-apple-system,sans-serif",
      "pointer-events:auto",
      "box-shadow:0 8px 24px rgba(0,0,0,0.3)",
      "backdrop-filter:blur(8px)",
    ].join(";");
  }
}
