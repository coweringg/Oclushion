import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { OclushionCanvas } from "../../canvas/OclushionCanvas";
import type { CanvasService } from "../../canvas/canvas.service";
import type { SpatialLayoutService } from "../../canvas/spatial-layout.service";

export class SpatialCanvasRenderer {
  private reactRoot: Root | null = null;

  constructor(
    private readonly canvasService: CanvasService,
    private readonly spatialLayoutService: SpatialLayoutService,
  ) {}

  public render(container: HTMLElement): void {
    if (!this.reactRoot) {
      this.reactRoot = createRoot(container);
    }

    this.reactRoot.render(
      <React.StrictMode>
        <OclushionCanvas
          canvasService={this.canvasService}
          spatialLayoutService={this.spatialLayoutService}
          mode="spatial"
        />
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
