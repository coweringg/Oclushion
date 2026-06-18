import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders with text children", () => {
    const el = Badge({ children: "New" });
    expect(el.props.children).toBe("New");
    expect(el.props.className).toContain("ocl-badge--default");
  });

  it("renders count capped at 99+", () => {
    const el = Badge({ count: 150 });
    expect(el.props.children).toBe("99+");
  });

  it("renders count as string", () => {
    const el = Badge({ count: 7 });
    expect(el.props.children).toBe("7");
  });

  it("renders dot variant", () => {
    const el = Badge({ dot: true });
    expect(el.props.className).toContain("ocl-badge--dot");
  });

  it("applies color variant", () => {
    const el = Badge({ variant: "success", children: "Live" });
    expect(el.props.className).toContain("ocl-badge--success");
  });
});
