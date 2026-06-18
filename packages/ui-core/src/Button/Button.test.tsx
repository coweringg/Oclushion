import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "./Button";

function render(el: ReturnType<typeof createElement>): string {
  return renderToString(el);
}

describe("Button", () => {
  it("renders with default props", () => {
    const html = render(createElement(Button, null, "Click"));
    expect(html).toContain('class="ocl-btn ocl-btn--primary ocl-btn--md');
    expect(html).toContain("ocl-btn__content\">Click</span></button>");
  });

  it("applies variant class", () => {
    const html = render(createElement(Button, { variant: "danger" }, "Delete"));
    expect(html).toContain("ocl-btn--danger");
  });

  it("applies size class", () => {
    const html = render(createElement(Button, { size: "lg" }, "Big"));
    expect(html).toContain("ocl-btn--lg");
  });

  it("disables when loading", () => {
    const html = render(createElement(Button, { loading: true }, "Saving"));
    expect(html).toContain("disabled");
    expect(html).toContain("ocl-btn--loading");
  });

  it("applies fullWidth class", () => {
    const html = render(createElement(Button, { fullWidth: true }, "Full"));
    expect(html).toContain("ocl-btn--full");
  });

  it("merges custom className", () => {
    const html = render(createElement(Button, { className: "custom" }, "X"));
    expect(html).toContain("custom");
  });
});
