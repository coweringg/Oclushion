import { BaseController, type ControllerContext } from "./controller";
import { ContextMenuRenderer, type ContextMenuState, type ContextMenuItem } from "./renderers/context-menu.renderer";
import { logger } from "../utils/logger";

export class ContextMenuController extends BaseController {
  private renderer = new ContextMenuRenderer();
  private container: HTMLElement | null = null;
  private state: ContextMenuState;

  private fileItems: ContextMenuItem[] = [
    { id: "new-file", label: "New File", icon: "📄" },
    { id: "new-folder", label: "New Folder", icon: "📁" },
    { id: "div1", label: "", isDivider: true },
    { id: "copy", label: "Copy", shortcut: "Ctrl+C" },
    { id: "copy-path", label: "Copy Path", shortcut: "Shift+Alt+C" },
    { id: "div2", label: "", isDivider: true },
    { id: "rename", label: "Rename...", shortcut: "F2" },
    { id: "delete", label: "Delete", shortcut: "Del", danger: true },
  ];

  private editorItems: ContextMenuItem[] = [
    { id: "go-to-def", label: "Go to Definition", shortcut: "F12" },
    { id: "peek-def", label: "Peek Definition", shortcut: "Alt+F12" },
    { id: "div1", label: "", isDivider: true },
    { id: "format", label: "Format Document", shortcut: "Shift+Alt+F" },
    { id: "div2", label: "", isDivider: true },
    { id: "ai-refactor", label: "Refactor with AI...", icon: "✨", shortcut: "Ctrl+I" },
    { id: "ai-explain", label: "Explain this code", icon: "🧠" },
  ];

  public constructor(context: ControllerContext) {
    super(context);
    
    this.state = {
      isVisible: false,
      x: 0,
      y: 0,
      items: [],
      targetId: null,
      targetType: 'generic'
    };
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("context-menu-root")
      : this.context.root.querySelector("#context-menu-root");

    if (!this.container) {
      return;
    }

    this.attachEvents();
  }

  private attachEvents(): void {
    document.addEventListener("contextmenu", (e) => {
      const target = e.target as HTMLElement;
      
      if (target.closest("#file-explorer")) {
        this.showMenu(e.clientX, e.clientY, this.fileItems, 'file');
        e.preventDefault();
      } else if (target.closest("#app")) {
        this.showMenu(e.clientX, e.clientY, this.editorItems, 'editor');
        e.preventDefault();
      } else {
        this.hideMenu();
      }
    });

    document.addEventListener("click", (e) => {
      if (this.state.isVisible) {
        this.hideMenu();
      }
    });

    if (this.container) {
      this.container.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest(".ocl-cm-item") as HTMLElement;
        
        if (item) {
          const action = item.dataset.action;
          if (action) {
            logger.info("ContextMenu", `Action: ${action} on type: ${this.state.targetType}`);
          }
          this.hideMenu();
          e.stopPropagation();
        }
      });
    }
  }

  private showMenu(x: number, y: number, items: ContextMenuItem[], type: 'file' | 'editor' | 'generic'): void {
    this.state = {
      isVisible: true,
      x,
      y,
      items,
      targetType: type,
      targetId: null
    };
    this.render();
  }

  private hideMenu(): void {
    if (this.state.isVisible) {
      this.state.isVisible = false;
      this.render();
    }
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
