import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const webDir = resolve(import.meta.dirname, "../../../apps/web");
const host = process.env.HOSTNAME ?? "127.0.0.1";
const port = process.env.PORT ?? "3000";

process.chdir(webDir);

const candidates = [
  ".next/standalone/apps/web/server.js",
  ".next/standalone/server.js",
];

let serverJs = null;
for (const c of candidates) {
  const full = resolve(webDir, c);
  if (existsSync(full)) {
    serverJs = full;
    break;
  }
}

if (!serverJs) {
  console.error("server.js not found in", candidates.join(", "));
  process.exit(1);
}

console.log("Starting:", serverJs);
const child = spawn(process.execPath, [serverJs], {
  cwd: webDir,
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: String(port),
  },
});

child.on("exit", (code) => {
  console.error("standalone server exited with code", code);
  process.exit(code ?? 1);
});
