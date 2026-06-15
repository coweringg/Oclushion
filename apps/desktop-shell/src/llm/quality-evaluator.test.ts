import { describe, expect, it } from "vitest";
import { QualityEvaluator } from "./quality-evaluator";

describe("QualityEvaluator", () => {
  const evaluator = new QualityEvaluator();

  it("evaluates a high-quality response", async () => {
    const result = await evaluator.evaluate({
      prompt: "How do I create a React component?",
      response: "Here's how to create a React component:\n\n1. Define a function\n2. Return JSX\n3. Export it\n\nExample:\n\`\`\`tsx\nfunction MyComponent() {\n  return <div>Hello</div>;\n}\n\`\`\`",
    });
    expect(result.overall).toBeGreaterThanOrEqual(5);
    expect(result.relevance).toBeGreaterThanOrEqual(1);
    expect(result.relevance).toBeLessThanOrEqual(10);
  });

  it("scores relevance low for unrelated response", async () => {
    const result = await evaluator.evaluate({
      prompt: "How do I deploy to Kubernetes?",
      response: "React components are the building blocks of any React application.",
    });
    expect(result.relevance).toBeLessThan(6);
  });

  it("scores safety low for unsafe content", async () => {
    const result = await evaluator.evaluate({
      prompt: "How do I hack a database?",
      response: "You can exploit the SQL injection vulnerability by using: DROP TABLE users;",
    });
    expect(result.safety).toBeLessThan(6);
  });

  it("evaluates with expected response for accuracy", async () => {
    const result = await evaluator.evaluate({
      prompt: "What is 2+2?",
      response: "2+2 equals 4. This is basic arithmetic.",
      expected: "4",
    });
    expect(result.accuracy).toBeGreaterThanOrEqual(5);
  });

  it("computes aggregate scores", () => {
    const scores = [
      { relevance: 8, accuracy: 7, helpfulness: 9, safety: 9, overall: 8.2, explanation: "" },
      { relevance: 6, accuracy: 5, helpfulness: 7, safety: 9, overall: 6.8, explanation: "" },
      { relevance: 9, accuracy: 8, helpfulness: 8, safety: 9, overall: 8.5, explanation: "" },
    ];
    const agg = evaluator.computeAggregate(scores);
    expect(agg.avgRelevance).toBeCloseTo(7.7, 1);
    expect(agg.avgAccuracy).toBeCloseTo(6.7, 1);
    expect(agg.avgOverall).toBeCloseTo(7.8, 1);
    expect(agg.passRate).toBe(1);
  });

  it("returns zeros for empty batch", () => {
    const agg = evaluator.computeAggregate([]);
    expect(agg.avgOverall).toBe(0);
    expect(agg.passRate).toBe(0);
  });

  it("clamps values between 1 and 10", async () => {
    const result = await evaluator.evaluate({
      prompt: "test",
      response: "ok",
    });
    for (const key of ["relevance", "accuracy", "helpfulness", "safety", "overall"] as const) {
      expect(result[key]).toBeGreaterThanOrEqual(1);
      expect(result[key]).toBeLessThanOrEqual(10);
    }
  });
});
