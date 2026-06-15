import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.OCLUSHION_E2E_DATABASE_URL ??
  process.env.SANO_E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/oclushion";
const internalToken = "oclushion-e2e-internal-token-requires-32-chars";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: [
    {
      command: "node tests/e2e/fixtures/mock-upstream.mjs",
      port: 8090,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "python -m uvicorn src.main:app --host 127.0.0.1 --port 8081",
      cwd: "packages/sano-shield-pii-service",
      port: 8081,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @oclushion/proxy exec tsx src/server.ts",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        REDIS_URL: "redis://127.0.0.1:6379",
        PII_SERVICE_URL: "http://127.0.0.1:8081",
        TOKEN_MAPPING_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        TOKEN_MAPPING_TTL_SECONDS: "300",
        CONTROL_API_INTERNAL_TOKEN: internalToken,
        PROXY_POLICY_ORGANIZATION_IDS: "",
        PROXY_PORT: "8080",
        PROXY_HOST: "127.0.0.1",
        PROXY_ALLOWED_UPSTREAM_HOSTS: "127.0.0.1",
        OPENAI_UPSTREAM_BASE_URL: "http://127.0.0.1:8090",
        ANTHROPIC_UPSTREAM_BASE_URL: "http://127.0.0.1:8090",
        ENABLE_AUDIT_LOG: "true",
        ENABLE_RATE_LIMITING: "false",
      },
    },
    {
      command: "pnpm --filter @oclushion/web build && node tests/e2e/fixtures/start-web-standalone.mjs",
      port: 3000,
      timeout: 360_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        DATABASE_URL: databaseUrl,
      },
    },
    {
      command: "pnpm --filter @oclushion/desktop-shell exec vite --port 5173",
      port: 5173,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
