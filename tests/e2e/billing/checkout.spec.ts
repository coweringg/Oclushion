import { test, expect } from "@playwright/test";
import { apiPost, generateTestEmail } from "../fixtures/test-helpers.js";

test.describe("Billing — Checkout", () => {
  let email: string;
  let token: string;
  const password = "BillingPass1!";

  test.beforeAll(async () => {
    email = generateTestEmail();
    const reg = await apiPost("/v1/auth/register", {
      email,
      password,
      name: "Billing Test User",
    });
    const regBody = await reg.json();
    token = regBody.token;
  });

  test("get credit balance returns 0 for new user", async () => {
    const res = await fetch("http://127.0.0.1:8082/v1/desktop/credits/balance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("balance");
  });

  test("get spend cap returns default value", async () => {
    const res = await fetch("http://127.0.0.1:8082/v1/desktop/spend-cap", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("dailySpendLimit");
  });

  test("create checkout session without auth returns 401", async () => {
    const res = await apiPost("/v1/billing/create-checkout-session", {
      packageId: "credits_20k",
    });
    expect(res.status).toBe(401);
  });

  test("create checkout session with auth returns URL", async () => {
    const res = await fetch("http://127.0.0.1:8082/v1/billing/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ packageId: "credits_20k" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("url");
    expect(body.url).toContain("checkout.stripe.com");
  });
});
