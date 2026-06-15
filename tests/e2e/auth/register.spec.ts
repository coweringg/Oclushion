import { test, expect } from "@playwright/test";
import { apiPost, generateTestEmail } from "../fixtures/test-helpers.js";

test.describe("Auth — Registration", () => {
  test("register with valid data returns token and user", async () => {
    const email = generateTestEmail();
    const res = await apiPost("/v1/auth/register", {
      email,
      password: "StrongPass1!",
      name: "New User",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe(email);
    expect(body.user.name).toBe("New User");
  });

  test("register with duplicate email returns 409", async () => {
    const email = generateTestEmail();
    await apiPost("/v1/auth/register", {
      email,
      password: "StrongPass1!",
      name: "First User",
    });
    const res = await apiPost("/v1/auth/register", {
      email,
      password: "OtherPass1!",
      name: "Second User",
    });
    expect(res.status).toBe(409);
  });

  test("register with weak password returns 400", async () => {
    const res = await apiPost("/v1/auth/register", {
      email: generateTestEmail(),
      password: "weak",
      name: "Weak Pass User",
    });
    expect(res.status).toBe(400);
  });

  test("register with missing name returns 400", async () => {
    const res = await apiPost("/v1/auth/register", {
      email: generateTestEmail(),
      password: "StrongPass1!",
    });
    expect(res.status).toBe(400);
  });
});
