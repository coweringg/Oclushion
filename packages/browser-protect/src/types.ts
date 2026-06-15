import type { SensitiveEntityType } from "@oclushion/shared";

export type BrowserDetection = {
  type: SensitiveEntityType;
  start: number;
  end: number;
  confidence: number;
};

export type BrowserProtectionDecision = {
  effect: "ALLOW" | "TOKENIZE" | "BLOCK" | "REQUIRE_APPROVAL";
  reasonCode: string;
  detections: BrowserDetection[];
  sanitizedText: string;
  counts: Partial<Record<SensitiveEntityType, number>>;
};

export type BrowserAuditEvent = {
  organizationId: string;
  module: "browser-protect";
  action: "browser_prompt_submit" | "browser_paste" | "browser_file_upload";
  eventType: "browser.protection_decision";
  decision: BrowserProtectionDecision["effect"];
  status: "allowed" | "blocked" | "pending_approval" | "failed";
  detectionCounts: Partial<Record<SensitiveEntityType, number>>;
  metadata: {
    host: string;
    selector: string;
    promptLength: number;
  };
};
