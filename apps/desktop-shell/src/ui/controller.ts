import type { AppStateManager } from "../state/app-state";

export type ControllerContext = {
  state: AppStateManager;
  root: Document | HTMLElement;
};

export interface UIController {
  mount(): void;
  destroy(): void;
}

export abstract class BaseController implements UIController {
  private readonly disposers: Array<() => void> = [];

  protected constructor(protected readonly context: ControllerContext) {}

  public abstract mount(): void;

  public destroy(): void {
    while (this.disposers.length) {
      this.disposers.pop()?.();
    }
  }

  protected listen<K extends keyof HTMLElementEventMap>(
    selector: string,
    type: K,
    handler: (event: HTMLElementEventMap[K], element: HTMLElement) => void,
  ): void {
    const listener = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(selector) : null;
      if (target) {
        handler(event as HTMLElementEventMap[K], target);
      }
    };
    this.context.root.addEventListener(type, listener);
    this.disposers.push(() => this.context.root.removeEventListener(type, listener));
  }
}
