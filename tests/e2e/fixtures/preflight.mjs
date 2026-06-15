import { execSync } from "node:child_process";

console.log("[preflight] Checking dependencies...");

try {
  execSync("pnpm --version", { stdio: "pipe" });
  console.log("[preflight] pnpm OK");
} catch {
  console.error("[preflight] pnpm not found");
  process.exit(1);
}

try {
  execSync("playwright --version", { stdio: "pipe" });
  console.log("[preflight] Playwright OK");
} catch {
  console.error("[preflight] Playwright not installed. Run: pnpm test:e2e:install");
  process.exit(1);
}

console.log("[preflight] All checks passed");
