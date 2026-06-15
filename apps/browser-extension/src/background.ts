import { createBrowserAuditEvent, protectBrowserText } from "@oclushion/browser-protect";

import type {
  BrowserProtectConfig,
  ProtectionRequest,
  ProtectionResponse,
  StatusRequest,
  StatusResponse,
} from "./messages.js";

const defaultConfig: BrowserProtectConfig = {
  enabled: true,
  organizationId: "11111111-1111-4111-8111-111111111111",
  auditEndpoint: "http://127.0.0.1:8082/v1/browser/audit-events",
  auditToken: "sano_local_control_admin_2026_change_before_deploy",
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: unknown): Promise<ProtectionResponse | StatusResponse | { error: string }> {
  if (isStatusRequest(message)) {
    return { type: "SANO_BROWSER_STATUS_RESULT", config: await readConfig() };
  }
  if (!isProtectionRequest(message)) {
    return { error: "Unsupported Browser Protect message." };
  }

  const config = await readConfig();
  const decision = config.enabled
    ? protectBrowserText(message.text)
    : {
        effect: "ALLOW" as const,
        reasonCode: "extension_disabled",
        detections: [],
        sanitizedText: message.text,
        counts: {},
      };
  await auditDecision(config, message, decision);
  return { type: "SANO_BROWSER_PROTECT_RESULT", decision };
}

async function readConfig() {
  const stored = await chrome.storage.local.get<BrowserProtectConfig>([
    "enabled",
    "organizationId",
    "auditEndpoint",
    "auditToken",
  ]);
  return { ...defaultConfig, ...stored };
}

async function auditDecision(
  config: BrowserProtectConfig,
  message: ProtectionRequest,
  decision: ProtectionResponse["decision"],
) {
  const event = createBrowserAuditEvent({
    organizationId: config.organizationId,
    action: message.action,
    decision,
    host: message.host,
    selector: message.selector,
    promptLength: message.text.length,
  });

  try {
    await fetch(config.auditEndpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.auditToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(event),
    });
  } catch {
    await chrome.storage.local.set({ lastAuditErrorAt: new Date().toISOString() });
  }
}

function isProtectionRequest(message: unknown): message is ProtectionRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as ProtectionRequest).type === "SANO_BROWSER_PROTECT"
  );
}

function isStatusRequest(message: unknown): message is StatusRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as StatusRequest).type === "SANO_BROWSER_STATUS"
  );
}
