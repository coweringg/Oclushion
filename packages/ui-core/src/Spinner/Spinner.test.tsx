import { describe, it, expect } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders with default props", () => {
    const el = Spinner({});
    expect(el.props.className).toContain("ocl-spinner--md");
    expect(el.props.className).toContain("ocl-spinner--primary");
  });

  it("applies size", () => {
    const el = Spinner({ size: "lg" });
    expect(el.props.className).toContain("ocl-spinner--lg");
  });

  it("applies variant", () => {
    const el = Spinner({ variant: "success" });
    expect(el.props.className).toContain("ocl-spinner--success");
  });
});
