import { t } from "../i18n/translate";
import { BaseController, type ControllerContext } from "./controller";
import { OSTabsRenderer, type OSTabsState, type OSTab } from "./renderers/os-tabs.renderer";
import { WelcomeScreenRenderer } from "./renderers/welcome-screen.renderer";
import type { EditorController } from "../editor/editor.controller";
import { CanvasRenderer } from "./renderers/canvas.renderer";
import type { CanvasService } from "../canvas/canvas.service";

export class OsTabsController extends BaseController {
  private readonly renderer = new OSTabsRenderer();
  private readonly welcomeRenderer = new WelcomeScreenRenderer();
  private canvasRenderer: CanvasRenderer | null = null;
  private container: HTMLElement | null = null;
  private viewPort: HTMLElement | null = null;
  
  private currentState: OSTabsState = {
    tabs: [
      { id: "editor", title: "main.ts", icon: "📄" },
      { id: "browser", title: "Localhost", icon: "🌍" },
      { id: "figma", title: "Dashboard Mockup", icon: "🎨" },
      { id: "chat", title: "Backend Team", icon: "💬" }
    ],
    activeTabId: "editor",
  };

  public constructor(
    context: ControllerContext,
    private readonly editor: EditorController,
    private readonly canvasService?: CanvasService
  ) {
    super(context);
    if (this.canvasService) {
      this.canvasRenderer = new CanvasRenderer(this.canvasService);
    }
  }

  public mount(): void {
    const root = this.context.root as HTMLElement;
    this.container = root.querySelector("#ocl-os-tabs-mount");
    this.viewPort = root.querySelector("#ocl-view-port");

    if (!this.container || !this.viewPort) return;

    this.ensureViewsExist();
    this.attachEvents();
    this.render();
  }

  private ensureViewsExist(): void {
    if (!this.viewPort) return;
    
    if (!this.viewPort.querySelector("#browser-view")) {
      const browser = document.createElement("div");
      browser.id = "browser-view";
      browser.className = "ocl-view";
      browser.innerHTML = `
        <div class="ocl-browser-url-bar">
          <button style="background:none;border:none;color:#fff;cursor:pointer;">⬅</button>
          <button style="background:none;border:none;color:#fff;cursor:pointer;">➡</button>
          <button style="background:none;border:none;color:#fff;cursor:pointer;">↻</button>
          <input type="text" value="http://localhost:3000" />
        </div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;color:#666;">
          Browser Engine Mounting...
        </div>
      `;
      this.viewPort.appendChild(browser);
    }

    if (!this.viewPort.querySelector("#figma-view")) {
      const figma = document.createElement("div");
      figma.id = "figma-view";
      figma.className = "ocl-view";
      this.viewPort.appendChild(figma);
      
      if (this.canvasRenderer) {
        this.canvasRenderer.render(figma);
      } else {
        figma.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#666;background:#1e1e1e;">${t("osTabs.canvasMounting")}</div>`;
      }
    }

    if (!this.viewPort.querySelector("#chat-view")) {
      const chat = document.createElement("div");
      chat.id = "chat-view";
      chat.className = "ocl-view";
      chat.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#666;background:#1e1e1e;">${t("osTabs.chatMounting")}</div>`;
      this.viewPort.appendChild(chat);
    }
    
    if (!this.viewPort.querySelector("#welcome-view")) {
      const welcome = document.createElement("div");
      welcome.id = "welcome-view";
      welcome.className = "ocl-view";
      this.viewPort.appendChild(welcome);
      this.welcomeRenderer.render(welcome);
    }
  }

  private attachEvents(): void {
    this.listen(".ocl-tab", "click", (e, element) => {
      const isCloseBtn = (e.target as HTMLElement).getAttribute("data-action") === "close";
      const tabId = element.getAttribute("data-tab-id");
      
      if (!tabId) return;

      if (isCloseBtn) {
        this.currentState.tabs = this.currentState.tabs.filter(t => t.id !== tabId);
        if (this.currentState.activeTabId === tabId && this.currentState.tabs.length > 0) {
          this.currentState.activeTabId = this.currentState.tabs[0]?.id ?? "welcome";
        } else if (this.currentState.tabs.length === 0) {
          this.currentState.activeTabId = "welcome";
        }
      } else {
        this.currentState.activeTabId = tabId;
      }
      
      this.render();
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.currentState);
    }
    
    if (this.viewPort) {
      const views = this.viewPort.querySelectorAll(".ocl-view");
      views.forEach(v => v.classList.remove("active"));
      
      let activeViewId = "welcome-view";
      if (this.currentState.tabs.length > 0) {
        activeViewId = this.currentState.activeTabId === "editor" ? "app" : `${this.currentState.activeTabId}-view`;
      }
      
      const activeView = this.viewPort.querySelector(`#${activeViewId}`);
      if (activeView) {
        activeView.classList.add("active");
      }
    }
  }
}
