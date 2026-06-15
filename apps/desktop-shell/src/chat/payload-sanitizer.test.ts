import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeModelPayload, extractSanitizedUserMessage } from "./payload-sanitizer";
import { logger } from "../utils/logger";
import type { SanoShield, SanoShieldTokenMapping } from "../sano-shield.service";
import type { HistoryMessage } from "./message-history";

vi.mock("../utils/logger", () => ({
  logger: { warn: vi.fn() },
}));

function createMockShield(overrides?: Partial<SanoShield>): SanoShield {
  return {
    sanitize: vi.fn(),
    ...overrides,
  } as unknown as SanoShield;
}

const defaultPayload = {
  systemPrompt: "You are a helpful assistant.",
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ] as HistoryMessage[],
};

describe("sanitizeModelPayload", () => {
  let shield: SanoShield;

  beforeEach(() => {
    vi.clearAllMocks();
    shield = createMockShield();
  });

  it("returns sanitized payload with mappings when shield sanitizes successfully", () => {
    const sanitizedText = JSON.stringify(defaultPayload);
    const mappings: SanoShieldTokenMapping[] = [{ token: "<TOKEN>", original: "secret", type: "email" }];
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.systemPrompt).toBe(defaultPayload.systemPrompt);
    expect(result.messages).toEqual(defaultPayload.messages);
    expect(result.mappings).toEqual(mappings);
    expect(shield.sanitize).toHaveBeenCalledWith(JSON.stringify(defaultPayload));
  });

  it("normalizes unknown roles to 'assistant'", () => {
    const payload = {
      ...defaultPayload,
      messages: [
        { role: "user", content: "hi" },
        { role: "tool", content: "result" },
        { role: "function", content: "fn result" },
      ] as HistoryMessage[],
    };
    const sanitizedText = JSON.stringify(payload);
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, payload);

    expect(result.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "result" },
      { role: "assistant", content: "fn result" },
    ]);
  });

  it("filters out messages with non-string content", () => {
    const payload = {
      systemPrompt: "test",
      messages: [
        { role: "user", content: "valid" },
        { role: "assistant", content: 123 },
        { role: "user", content: "" },
        { role: "user", content: "also valid" },
      ] as unknown as HistoryMessage[],
    };
    const sanitizedText = JSON.stringify(payload);
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, payload);

    expect(result.messages).toEqual([
      { role: "user", content: "valid" },
      { role: "user", content: "also valid" },
    ]);
  });

  it("filters out messages with empty string content, keeps whitespace-only content", () => {
    const payload = {
      systemPrompt: "test",
      messages: [
        { role: "user", content: "ok" },
        { role: "user", content: "" },
        { role: "assistant", content: "  " },
      ] as HistoryMessage[],
    };
    const sanitizedText = JSON.stringify(payload);
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, payload);
    expect(result.messages).toEqual([
      { role: "user", content: "ok" },
      { role: "assistant", content: "  " },
    ]);
  });

  it("falls back to original payload when all messages are filtered out", () => {
    const payload = {
      systemPrompt: "test",
      messages: [{ role: "user", content: "" }] as HistoryMessage[],
    };
    const sanitizedText = JSON.stringify(payload);
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, payload);

    expect(result.messages).toEqual(payload.messages);
  });

  it("uses sanitized systemPrompt when present, falls back to original otherwise", () => {
    const payload = { ...defaultPayload, systemPrompt: "original prompt" };

    const withPrompt = JSON.stringify({ ...payload, systemPrompt: "sanitized prompt" });
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText: withPrompt, mappings: [] });
    expect(sanitizeModelPayload(shield, payload).systemPrompt).toBe("sanitized prompt");

    const withoutPrompt = JSON.stringify({ messages: payload.messages });
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText: withoutPrompt, mappings: [] });
    expect(sanitizeModelPayload(shield, payload).systemPrompt).toBe("original prompt");
  });

  it("returns original payload with mappings when JSON parse fails", () => {
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText: "not json", mappings: [] });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.systemPrompt).toBe(defaultPayload.systemPrompt);
    expect(result.messages).toEqual(defaultPayload.messages);
    expect(result.mappings).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "PayloadSanitizer",
      "Failed to parse sanitized payload",
      expect.any(Error),
    );
  });

  it("returns original payload with mappings when zod validation fails on malformed shape", () => {
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText: "null", mappings: [] });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.systemPrompt).toBe(defaultPayload.systemPrompt);
    expect(result.messages).toEqual(defaultPayload.messages);
    expect(logger.warn).toHaveBeenCalledWith(
      "PayloadSanitizer",
      "Failed to parse sanitized payload",
      expect.any(Error),
    );
  });

  it("returns original payload with mappings when parsed value is not an object", () => {
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText: '"just a string"', mappings: [] });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.systemPrompt).toBe(defaultPayload.systemPrompt);
    expect(result.messages).toEqual(defaultPayload.messages);
    expect(logger.warn).toHaveBeenCalledWith(
      "PayloadSanitizer",
      "Failed to parse sanitized payload",
      expect.any(Error),
    );
  });

  it("handles messages being undefined in parsed payload", () => {
    vi.mocked(shield.sanitize).mockReturnValue({
      sanitizedText: '{"systemPrompt": "new prompt"}',
      mappings: [],
    });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.systemPrompt).toBe("new prompt");
    expect(result.messages).toEqual(defaultPayload.messages);
  });

  it("rejects messages with invalid structure (null message)", () => {
    const sanitizedText = JSON.stringify({ messages: [null] });
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, defaultPayload);

    expect(result.messages).toEqual(defaultPayload.messages);
  });

  it("handles empty messages array", () => {
    const sanitizedText = JSON.stringify({ messages: [] });
    vi.mocked(shield.sanitize).mockReturnValue({ sanitizedText, mappings: [] });

    const result = sanitizeModelPayload(shield, {
      systemPrompt: "test",
      messages: [],
    });

    expect(result.messages).toEqual([]);
  });
});

describe("extractSanitizedUserMessage", () => {
  it("extracts content between <user_message> tags", () => {
    const result = extractSanitizedUserMessage(
      "prefix <user_message>hello world</user_message> suffix",
    );
    expect(result).toBe("hello world");
  });

  it("extracts multiline content", () => {
    const result = extractSanitizedUserMessage(
      "<user_message>line1\nline2\nline3</user_message>",
    );
    expect(result).toBe("line1\nline2\nline3");
  });

  it("returns null when no tags are present", () => {
    expect(extractSanitizedUserMessage("no tags here")).toBeNull();
  });

  it("returns null when only opening tag is present", () => {
    expect(extractSanitizedUserMessage("<user_message>no closing")).toBeNull();
  });

  it("returns null on empty string", () => {
    expect(extractSanitizedUserMessage("")).toBeNull();
  });

  it("extracts content with special regex characters", () => {
    const result = extractSanitizedUserMessage(
      "<user_message>$100 (deposit) [important]</user_message>",
    );
    expect(result).toBe("$100 (deposit) [important]");
  });

  it("extracts content with nested angle brackets", () => {
    const result = extractSanitizedUserMessage(
      "<user_message>some <text> here</user_message>",
    );
    expect(result).toBe("some <text> here");
  });

  it("returns first match when multiple tags exist", () => {
    const result = extractSanitizedUserMessage(
      "<user_message>first</user_message><user_message>second</user_message>",
    );
    expect(result).toBe("first");
  });
});
