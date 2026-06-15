import { describe, expect, it } from "vitest";

import { sanitizePayload } from "../src/sanitizers/payload-sanitizer.js";

describe("payload sanitizer", () => {
  it("does not allocate a token already present in user content", async () => {
    const result = await sanitizePayload(
      "Conserva [EMAIL_0] y escribe a juan@example.com",
      {
        analyze: async (_requestId, text) => {
          void _requestId;
          const sensitive = "juan@example.com";
          const start = text.indexOf(sensitive);
          return [{ type: "email", start, end: start + sensitive.length, confidence: 1 }];
        },
      },
      "request-1",
    );

    expect(result.payload).toBe("Conserva [EMAIL_0] y escribe a [EMAIL_1]");
    expect(result.mapping).toEqual({ "[EMAIL_1]": "juan@example.com" });
    expect(result.counts).toEqual({ email: 1 });
  });
});
