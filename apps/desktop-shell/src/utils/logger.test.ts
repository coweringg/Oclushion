import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs info messages at info level", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "info");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.info("TestComponent", "hello");
    expect(consoleSpy).toHaveBeenCalledWith("[TestComponent] hello", undefined);
  });

  it("suppresses debug messages at info level", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "info");
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.debug("TestComponent", "should not appear");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs debug messages at debug level", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "debug");
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.debug("TestComponent", "debug msg");
    expect(consoleSpy).toHaveBeenCalledWith("[TestComponent] debug msg", undefined);
  });

  it("logs warn messages", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "warn");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.warn("TestComponent", "warning");
    expect(consoleSpy).toHaveBeenCalledWith("[TestComponent] warning", undefined);
  });

  it("logs error messages with error object", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "error");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    const err = new Error("boom");
    logger.error("TestComponent", "fail", err);
    expect(consoleSpy).toHaveBeenCalledWith("[TestComponent] fail", err);
  });

  it("suppresses info at error level", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "error");
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.info("TestComponent", "should not appear");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("defaults to info level when VITE_LOG_LEVEL is not set", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { logger } = await import("./logger.js");
    logger.info("TestComponent", "default info");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
