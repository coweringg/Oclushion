import { test, expect } from "@playwright/test";
import { apiPost } from "../fixtures/test-helpers.js";

test.describe("SSO", () => {
  test("authorize with unknown domain returns 404", async () => {
    const res = await apiPost("/v1/auth/sso/authorize", {
      domain: "unknown-domain.example.com",
    });
    expect(res.status).toBe(404);
  });

  test("authorize without domain returns 400", async () => {
    const res = await apiPost("/v1/auth/sso/authorize", {});
    expect(res.status).toBe(400);
  });
});
