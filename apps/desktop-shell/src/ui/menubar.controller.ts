import { BaseController, type ControllerContext } from "./controller";
import { MenubarRenderer, type MenubarState, type MenuCategory } from "./renderers/menubar.renderer";
import { logger } from "../utils/logger";

export class MenubarController extends BaseController {
  private renderer = new MenubarRenderer();
  private container: HTMLElement | null = null;
  private state: MenubarState;

  public constructor(context: ControllerContext) {
    super(context);
    
    this.state = {
      activeCategoryId: null,
      categories: [
        {
          id: "file",
          label: "File",
          items: [
            { id: "new-file", label: "New File", shortcut: "Ctrl+N" },
            { id: "open-folder", label: "Open Folder...", shortcut: "Ctrl+O" },
            { id: "save", label: "Save", shortcut: "Ctrl+S" },
            { id: "exit", label: "Exit", shortcut: "Alt+F4" },
          ]
        },
        {
          id: "edit",
          label: "Edit",
          items: [
            { id: "undo", label: "Undo", shortcut: "Ctrl+Z" },
            { id: "redo", label: "Redo", shortcut: "Ctrl+Y" },
            { id: "cut", label: "Cut", shortcut: "Ctrl+X" },
            { id: "copy", label: "Copy", shortcut: "Ctrl+C" },
            { id: "paste", label: "Paste", shortcut: "Ctrl+V" },
          ]
        },
        {
          id: "view",
          label: "View",
          items: [
            { id: "toggle-sidebar", label: "Toggle Sidebar", shortcut: "Ctrl+B" },
            { id: "toggle-terminal", label: "Toggle Terminal", shortcut: "Ctrl+`" },
            { id: "zen-mode", label: "Zen Mode", shortcut: "F11" },
          ]
        },
        {
          id: "window",
          label: "Window",
          items: [
            { id: "minimize", label: "Minimize", shortcut: "Ctrl+M" },
            { id: "zoom-in", label: "Zoom In", shortcut: "Ctrl+=" },
            { id: "zoom-out", label: "Zoom Out", shortcut: "Ctrl+-" },
          ]
        },
        {
          id: "help",
          label: "Help",
          items: [
            { id: "welcome", label: "Welcome Guide" },
            { id: "shortcuts", label: "Keyboard Shortcuts", shortcut: "Ctrl+K Ctrl+S" },
            { id: "about", label: "About Oclushion" },
          ]
        }
      ]
    };
  }

  public mount(): void {
    this.container = this.context.root instanceof Document
      ? this.context.root.getElementById("ocl-menubar-mount")
      : this.context.root.querySelector("#ocl-menubar-mount");

    if (!this.container) {
      return;
    }

    this.render();
    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      const actionItem = target.closest(".ocl-dropdown-item") as HTMLElement;
      if (actionItem) {
        if (!actionItem.classList.contains("disabled")) {
          const action = actionItem.dataset.action;
          logger.info("Menubar", `Action selected: ${action}`);
          
          this.state.activeCategoryId = null;
          this.render();
        }
        e.stopPropagation();
        return;
      }

      const categoryItem = target.closest(".ocl-menubar-item") as HTMLElement;
      if (categoryItem) {
        const catId = categoryItem.dataset.category;
        if (catId) {
          if (this.state.activeCategoryId === catId) {
            this.state.activeCategoryId = null; // Toggle off
          } else {
            this.state.activeCategoryId = catId; // Toggle on
          }
          this.render();
        }
        e.stopPropagation();
        return;
      }
    });

    document.addEventListener("click", (e) => {
      if (this.state.activeCategoryId && this.container && !this.container.contains(e.target as Node)) {
        this.state.activeCategoryId = null;
        this.render();
      }
    });
    
    this.container.addEventListener("mouseover", (e) => {
      if (!this.state.activeCategoryId) return;
      
      const target = e.target as HTMLElement;
      const categoryItem = target.closest(".ocl-menubar-item") as HTMLElement;
      
      if (categoryItem) {
        const catId = categoryItem.dataset.category;
        if (catId && catId !== this.state.activeCategoryId) {
          this.state.activeCategoryId = catId;
          this.render();
        }
      }
    });
  }

  private render(): void {
    if (this.container) {
      this.renderer.render(this.container, this.state);
    }
  }
}
