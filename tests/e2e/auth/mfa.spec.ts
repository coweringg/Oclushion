import { test, expect } from "@playwright/test";
import { apiPost, generateTestEmail } from "../fixtures/test-helpers.js";

test.describe("Auth — MFA", () => {
  let email: string;
  let token: string;
  const password = "StrongPass1!";

  test.beforeAll(async () => {
    email = generateTestEmail();
    const reg = await apiPost("/v1/auth/register", {
      email,
      password,
      name: "MFA Test User",
    });
    const regBody = await reg.json();
    token = regBody.token;
  });

  test("setup MFA returns secret, URI, and 8 recovery codes", async () => {
    const res = await apiPost("/v1/auth/mfa/setup", {}, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("secret");
    expect(body.secret.length).toBeGreaterThanOrEqual(16);
    expect(body).toHaveProperty("uri");
    expect(body.uri).toContain("otpauth://totp/");
    expect(body).toHaveProperty("recoveryCodes");
    expect(body.recoveryCodes).toHaveLength(8);
  });

  test("setup MFA when already enabled returns 409", async () => {
    const res = await apiPost("/v1/auth/mfa/setup", {}, token);
    void await res.json();
    expect(res.status).toBe(409);
  });

  test("disable MFA when not enabled returns 400", async () => {
    const res = await apiPost("/v1/auth/mfa/disable", {}, token);
    expect(res.status).toBe(400);
  });

  test("login without MFA returns token directly (no mfaRequired)", async () => {
    const res = await apiPost("/v1/auth/login", { email, password });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("mfaRequired");
    expect(body).toHaveProperty("token");
  });
});
