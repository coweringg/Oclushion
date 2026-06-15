import { t } from "../i18n/translate";
import { logger } from "../utils/logger";
import { initializeServices } from "./app-init";
import { initializeAppLifecycle } from "./app-lifecycle";

function renderFatalError(title: string, message: string): void {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,sans-serif;padding:2rem;">
      <div style="max-width:480px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠</div>
        <h1 style="font-size:1.25rem;font-weight:600;margin:0 0 0.5rem;color:#fafafa;">${title}</h1>
        <p style="font-size:0.875rem;color:#a1a1aa;margin:0 0 1.5rem;line-height:1.5;">${message}</p>
        <button onclick="location.reload()" style="background:#27272a;color:#fafafa;border:1px solid #3f3f46;border-radius:0.5rem;padding:0.5rem 1.5rem;font-size:0.875rem;cursor:pointer;">${t("common.retry")}</button>
      </div>
    </div>`;
}

async function bootstrap(): Promise<void> {
  try {
    const services = await initializeServices();
    await initializeAppLifecycle(services);
  } catch (error) {
    logger.error("Bootstrap", "Failed to initialize:", error);
    const message = error instanceof Error ? error.message : String(error);
    renderFatalError(
      "Failed to start Oclushion",
      message || "An unexpected error occurred during initialization."
    );
  }
}

void bootstrap();
