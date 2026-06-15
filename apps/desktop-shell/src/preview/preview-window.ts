import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export class PreviewWindow {
  private windowInstance: WebviewWindow | null = null;
  private currentUrl = "";

  public async open(url: string): Promise<void> {
    this.currentUrl = url;
    this.windowInstance = new WebviewWindow("oclushion-live-preview", {
      url,
      title: "Oclushion Live Preview",
      width: 720,
      height: 900,
      resizable: true,
      focus: true,
    });
    await new Promise<void>((resolve, reject) => {
      this.windowInstance?.once("tauri://created", () => resolve());
      this.windowInstance?.once("tauri://error", (event) => reject(new Error(String(event.payload))));
    });
  }

  public async reload(): Promise<void> {
    if (this.currentUrl) {
      await this.windowInstance?.close();
      await this.open(this.currentUrl);
    }
  }
}
