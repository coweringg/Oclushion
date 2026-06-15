import { createApp } from "./app.js";
import { readEnvironment } from "./config/environment.js";
import { createRuntimeServices } from "./runtime-services.js";

const environment = readEnvironment();
const runtime = await createRuntimeServices(environment);
const ipDenyList = environment.PROXY_IP_DENYLIST
  ? environment.PROXY_IP_DENYLIST.split(",").map((ip) => ip.trim()).filter((ip) => ip.length > 0)
  : [];
const app = createApp(runtime.proxy, {
  enableRateLimiting: environment.ENABLE_RATE_LIMITING,
  rateLimitMax: environment.PROXY_RATE_LIMIT_MAX,
  maxBodyBytes: environment.PROXY_MAX_BODY_BYTES,
  ipDenyList,
});
app.addHook("onClose", async () => runtime.close());

async function start(): Promise<void> {
  try {
    await app.listen({ host: environment.PROXY_HOST, port: environment.PROXY_PORT });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

await start();
