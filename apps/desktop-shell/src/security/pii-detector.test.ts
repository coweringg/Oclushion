import { describe, expect, it } from "vitest";
import { PiiDetector } from "./pii-detector";

describe("PiiDetector", () => {
  const detector = new PiiDetector();

  it("detects JWT tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature";
    const result = detector.detectAll(jwt);
    expect(result.some((d) => d.type === "jwt")).toBe(true);
  });

  it("detects AWS access keys", () => {
    const result = detector.detectAll("AKIAIOSFODNN7EXAMPLE");
    expect(result.some((d) => d.type === "aws_key")).toBe(true);
  });

  it("detects GitHub tokens", () => {
    const result = detector.detectAll("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(result.some((d) => d.type === "github_token")).toBe(true);
  });

  it("detects SSH private keys", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
    const result = detector.detectAll(key);
    expect(result.some((d) => d.type === "private_key")).toBe(true);
  });

  it("detects connection strings", () => {
    const cs = "postgresql://user:pass@localhost:5432/db";
    const result = detector.detectAll(cs);
    expect(result.some((d) => d.type === "connection_string")).toBe(true);
  });

  it("detects Stripe keys", () => {
    const result = detector.detectAll("sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(result.some((d) => d.type === "stripe_key")).toBe(true);
  });

  it("detects bearer tokens", () => {
    const result = detector.detectAll("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.test");
    expect(result.some((d) => d.type === "bearer_token" || d.type === "jwt")).toBe(true);
  });

  it("detects IP addresses", () => {
    const result = detector.detectAll("server at 192.168.1.1 is active");
    expect(result.some((d) => d.type === "ip_address")).toBe(true);
  });

  it("detects context-based secrets (password: value)", () => {
    const result = detector.detectAll("DB_PASSWORD = Sup3rS3cr3tPass!");
    const ctx = result.filter((d) => d.method === "context" || d.method === "regex");
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("detects context-based secrets (api_key = value)", () => {
    const result = detector.detectAll("api_key: a1b2c3d4e5f6g7h8i9j0");
    const ctx = result.filter((d) => d.method === "context");
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("merges overlapping detections", () => {
    const overlapping = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
    const result = detector.detectAll(overlapping);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toBeGreaterThanOrEqual(result[i - 1].end);
    }
  });

  it("returns empty for clean text", () => {
    const result = detector.detectAll("Hello world, this is a normal conversation about programming.");
    expect(result).toHaveLength(0);
  });

  it("returns empty for empty string", () => {
    expect(detector.detectAll("")).toHaveLength(0);
  });

  it("detects NPM tokens", () => {
    const result = detector.detectAll("npm_" + "a".repeat(36));
    expect(result.some((d) => d.type === "npm_token")).toBe(true);
  });

  it("detects SendGrid keys", () => {
    const result = detector.detectAll("SG." + "a".repeat(22) + "." + "a".repeat(43));
    expect(result.some((d) => d.type === "sendgrid_key")).toBe(true);
  });

  it("respects custom patterns", () => {
    const custom = new PiiDetector({
      customPatterns: [{ type: "my_secret", label: "MY_SECRET", pattern: /CUSTOM_SECRET_\d+/g }],
    });
    const result = custom.detectAll("CUSTOM_SECRET_12345");
    expect(result.some((d) => d.type === "my_secret")).toBe(true);
  });

  it("does not flag numbers as context secrets", () => {
    const result = detector.detectAll("count: 42");
    expect(result.filter((d) => d.method === "context")).toHaveLength(0);
  });
});
