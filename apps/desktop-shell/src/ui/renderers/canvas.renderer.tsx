import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { OclushionCanvas } from "../../canvas/OclushionCanvas";
import type { CanvasService } from "../../canvas/canvas.service";

export class CanvasRenderer {
  private reactRoot: Root | null = null;

  constructor(private readonly canvasService: CanvasService) {}

  public render(container: HTMLElement): void {
    if (!this.reactRoot) {
      this.reactRoot = createRoot(container);
    }
    
    this.reactRoot.render(
      <React.StrictMode>
        <OclushionCanvas canvasService={this.canvasService} />
      </React.StrictMode>
    );
  }

  public unmount(): void {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
