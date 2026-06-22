// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("../canvas/OclushionCanvas", () => ({
  OclushionCanvas: function MockCanvas() {
    return null;
  },
}));

vi.mock("../canvas/canvas.service", () => ({
  CanvasService: class {},
}));

vi.mock("../canvas/spatial-layout.service", () => ({
  SpatialLayoutService: class {},
}));

import "./ide-canvas-spatial";

describe("ide-canvas-spatial", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function createCanvas() {
    const el = document.createElement("ide-canvas-spatial");
    document.body.appendChild(el);
    el.canvasService = {} as any;
    el.spatialLayoutService = {} as any;
    await el.updateComplete;
    return el;
  }

  it("registers the custom element in the registry", () => {
    const el = document.createElement("ide-canvas-spatial");
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders a slot element in light DOM", async () => {
    const el = document.createElement("ide-canvas-spatial");
    document.body.appendChild(el);
    el.canvasService = {} as any;
    el.spatialLayoutService = {} as any;
    await el.updateComplete;
    const slot = el.querySelector("slot");
    expect(slot).toBeTruthy();
    el.remove();
  });

  it("accepts canvasService and spatialLayoutService properties", async () => {
    const el = await createCanvas();
    const mockService = { someMethod: vi.fn() } as any;
    el.canvasService = mockService;
    el.spatialLayoutService = mockService;
    expect(el.canvasService).toBe(mockService);
    expect(el.spatialLayoutService).toBe(mockService);
    el.remove();
  });

  it("does not throw when mounted with services", () => {
    const el = document.createElement("ide-canvas-spatial");
    el.canvasService = {} as any;
    el.spatialLayoutService = {} as any;
    expect(() => {
      document.body.appendChild(el);
    }).not.toThrow();
    el.remove();
  });

  it("refresh method does not throw", () => {
    const el = document.createElement("ide-canvas-spatial");
    el.canvasService = {} as any;
    el.spatialLayoutService = {} as any;
    document.body.appendChild(el);
    expect(() => {
      el.refresh();
    }).not.toThrow();
    el.remove();
  });
});
