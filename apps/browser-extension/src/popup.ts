import type { StatusResponse } from "./messages.js";

async function render() {
  const status = (await chrome.runtime.sendMessage({ type: "SANO_BROWSER_STATUS" })) as StatusResponse;
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <main>
      <strong>Sano Browser Protect</strong>
      <p>${status.config.enabled ? "Activo" : "Desactivado"}</p>
      <small>Org: ${status.config.organizationId}</small>
    </main>
  `;
}

void render();
