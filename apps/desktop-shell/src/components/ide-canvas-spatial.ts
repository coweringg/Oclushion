import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { OclushionCanvas } from "../canvas/OclushionCanvas";
import type { CanvasService } from "../canvas/canvas.service";
import type { SpatialLayoutService } from "../canvas/spatial-layout.service";

@customElement("ide-canvas-spatial")
export class IdeCanvasSpatial extends LitElement {
  @property({ type: Object })
  canvasService: CanvasService | null = null;

  @property({ type: Object })
  spatialLayoutService: SpatialLayoutService | null = null;

  private reactRoot: Root | null = null;

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.mountReact();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unmountReact();
  }

  private mountReact(): void {
    if (this.reactRoot) return;
    if (!this.canvasService || !this.spatialLayoutService) return;

    this.reactRoot = createRoot(this);
    this.reactRoot.render(
      React.createElement(React.StrictMode, null,
        React.createElement(OclushionCanvas, {
          canvasService: this.canvasService,
          spatialLayoutService: this.spatialLayoutService,
          mode: "spatial",
        }),
      ),
    );
  }

  private unmountReact(): void {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }

  // Allow external code to trigger a re-render of the React tree
  public refresh(): void {
    this.unmountReact();
    this.mountReact();
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ide-canvas-spatial": IdeCanvasSpatial;
  }
}
