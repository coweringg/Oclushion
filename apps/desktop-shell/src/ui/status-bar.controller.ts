import { BaseController, type ControllerContext } from "./controller";
import { StatusBarRenderer, type StatusBarState } from "./renderers/status-bar.renderer";

export class StatusBarController extends BaseController {
  private renderer = new StatusBarRenderer();
  private container: HTMLElement | null = null;
  private state: StatusBarState;

  public constructor(context: ControllerContext) {
    super(context);
    
    this.state = {
      branchName: "main*",
      sanoShieldActive: true,
      ollamaReady: true,
      tsErrors: 0,
      tsWarnings: 2,
      cursorLine: 42,
      cursorCol: 15,
      encoding: "UTF-8",
      language: "TypeScript",
    };
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("ocl-status-bar")
      : this.context.root.querySelector("#ocl-status-bar");

    if (!this.container) {
      return;
    }

    this.render();
    
    setInterval(() => {
      if (Math.random() > 0.7) {
        this.state.cursorLine = Math.floor(Math.random() * 500) + 1;
        this.state.cursorCol = Math.floor(Math.random() * 80) + 1;
        this.render();
      }
    }, 2000);
  }

  public updateState(partialState: Partial<StatusBarState>): void {
    this.state = { ...this.state, ...partialState };
    this.render();
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
