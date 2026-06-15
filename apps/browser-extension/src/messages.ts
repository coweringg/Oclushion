import type { BrowserAuditEvent, BrowserProtectionDecision } from "@oclushion/browser-protect";

export type BrowserProtectConfig = {
  enabled: boolean;
  organizationId: string;
  auditEndpoint: string;
  auditToken: string;
};

export type ProtectionRequest = {
  type: "SANO_BROWSER_PROTECT";
  action: BrowserAuditEvent["action"];
  text: string;
  host: string;
  selector: string;
};

export type ProtectionResponse = {
  type: "SANO_BROWSER_PROTECT_RESULT";
  decision: BrowserProtectionDecision;
};

export type StatusRequest = { type: "SANO_BROWSER_STATUS" };
export type StatusResponse = { type: "SANO_BROWSER_STATUS_RESULT"; config: BrowserProtectConfig };
