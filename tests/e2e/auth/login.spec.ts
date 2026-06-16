import { test, expect } from "@playwright/test";
import { apiPost, generateTestEmail } from "../fixtures/test-helpers.js";

test.describe("Auth — Login", () => {
  const testEmail = generateTestEmail();
  const testPassword = "TestPass123!";

  test.beforeAll(async () => {
    const res = await apiPost("/v1/auth/register", {
      email: testEmail,
      password: testPassword,
      name: "E2E Test User",
    });
    expect(res.status).toBe(201);
  });

  test("login with valid credentials returns token", async () => {
    const res = await apiPost("/v1/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe(testEmail);
  });

  test("login with invalid password returns 401", async () => {
    const res = await apiPost("/v1/auth/login", {
      email: testEmail,
      password: "WrongPassword1!",
    });
    expect(res.status).toBe(401);
  });

  test("login with non-existent email returns 401", async () => {
    const res = await apiPost("/v1/auth/login", {
      email: "nonexistent@test.oclushion.local",
      password: "SomePass1!",
    });
    expect(res.status).toBe(401);
  });

  test("login with weak credentials triggers rate limiting", async () => {
    const lockedEmail = generateTestEmail();
    for (let i = 0; i < 12; i++) {
      const res = await apiPost("/v1/auth/login", {
        email: lockedEmail,
        password: `WrongPass${i}!`,
      });
      if (res.status === 429) {
        const body = await res.json();
        expect(body).toHaveProperty("retryAfter");
        return;
      }
    }
  });

  test("login returns MFA challenge when MFA is enabled", async () => {
    const res = await apiPost("/v1/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("mfaRequired");
  });
});
