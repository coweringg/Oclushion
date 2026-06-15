import { describe, it, expect } from "vitest";
import { toRecentHistory, historyMessageSchema } from "./message-history";

describe("toRecentHistory", () => {
  it("returns an empty array when input is undefined", () => {
    expect(toRecentHistory(undefined)).toEqual([]);
  });

  it("returns an empty array when input is an empty array", () => {
    expect(toRecentHistory([])).toEqual([]);
  });

  it("normalizes valid messages preserving user/assistant/system roles", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "system", content: "be nice" },
    ];

    const result = toRecentHistory(messages);

    expect(result).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "system", content: "be nice" },
    ]);
  });

  it("normalizes 'tool' role to 'assistant'", () => {
    const result = toRecentHistory([
      { role: "user", content: "run tool" },
      { role: "tool", content: "tool result" },
    ]);

    expect(result).toEqual([
      { role: "user", content: "run tool" },
      { role: "assistant", content: "tool result" },
    ]);
  });

  it("filters out messages with invalid roles", () => {
    const result = toRecentHistory([
      { role: "user", content: "valid" },
      { role: "admin", content: "invalid role" },
      { role: "bot", content: "also invalid" },
    ]);

    expect(result).toEqual([{ role: "user", content: "valid" }]);
  });

  it("keeps only the last 12 messages", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));

    const result = toRecentHistory(messages);

    expect(result).toHaveLength(12);
    expect(result[0]?.content).toBe("msg 8");
    expect(result[11]?.content).toBe("msg 19");
  });

  it("keeps all messages when count is less than 12", () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));

    const result = toRecentHistory(messages);

    expect(result).toHaveLength(5);
  });

  it("handles tool messages that are within the last 12 slice", () => {
    const messages = [
      { role: "user", content: "first" },
      { role: "tool", content: "tool call" },
    ];

    const result = toRecentHistory(messages);

    expect(result).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "tool call" },
    ]);
  });

  it("returns empty array when all messages have invalid roles", () => {
    const result = toRecentHistory([
      { role: "moderator", content: "nope" },
      { role: "bot", content: "nope" },
    ]);

    expect(result).toEqual([]);
  });
});

describe("historyMessageSchema", () => {
  it("validates a correct history message", () => {
    expect(historyMessageSchema.safeParse({ role: "user", content: "hello" }).success).toBe(true);
    expect(historyMessageSchema.safeParse({ role: "assistant", content: "world" }).success).toBe(true);
    expect(historyMessageSchema.safeParse({ role: "system", content: "prompt" }).success).toBe(true);
  });

  it("rejects an invalid role", () => {
    expect(historyMessageSchema.safeParse({ role: "tool", content: "data" }).success).toBe(false);
    expect(historyMessageSchema.safeParse({ role: "admin", content: "data" }).success).toBe(false);
  });

  it("rejects non-string content", () => {
    expect(historyMessageSchema.safeParse({ role: "user", content: 123 }).success).toBe(false);
    expect(historyMessageSchema.safeParse({ role: "user", content: null }).success).toBe(false);
    expect(historyMessageSchema.safeParse({ role: "user", content: undefined }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(historyMessageSchema.safeParse({ role: "user" }).success).toBe(false);
    expect(historyMessageSchema.safeParse({ content: "hello" }).success).toBe(false);
    expect(historyMessageSchema.safeParse({}).success).toBe(false);
  });
});
