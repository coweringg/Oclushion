import type { BrowserAuditEvent, BrowserDetection, BrowserProtectionDecision } from "./types.js";

const recognizers: Array<{ type: BrowserDetection["type"]; pattern: RegExp }> = [
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu },
  { type: "payment_card", pattern: /\b(?:\d[ -]?){13,19}\b/gu },
  { type: "api_key", pattern: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|sk-ant-[a-zA-Z0-9-]{32,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})\b/g },
  { type: "access_token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { type: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const labels: Record<BrowserDetection["type"], string> = {
  person: "PERSON",
  email: "EMAIL",
  phone: "PHONE",
  payment_card: "PAYMENT_CARD",
  bank_account: "BANK_ACCOUNT",
  api_key: "API_KEY",
  access_token: "ACCESS_TOKEN",
  private_key: "PRIVATE_KEY",
};

export function detectBrowserPii(text: string): BrowserDetection[] {
  const detections = recognizers.flatMap(({ type, pattern }) =>
    [...text.matchAll(pattern)].flatMap((match) =>
      match.index === undefined
        ? []
        : [{ type, start: match.index, end: match.index + match[0].length, confidence: 1 }],
    ),
  );
  return dedupe(detections).filter((detection) =>
    detection.type === "payment_card" ? passesLuhn(text.slice(detection.start, detection.end)) : true,
  );
}

export function protectBrowserText(text: string): BrowserProtectionDecision {
  const detections = detectBrowserPii(text);
  if (detections.length === 0) {
    return {
      effect: "ALLOW",
      reasonCode: "no_sensitive_data",
      detections,
      sanitizedText: text,
      counts: {},
    };
  }

  const counts: BrowserProtectionDecision["counts"] = {};
  const indices: Partial<Record<BrowserDetection["type"], number>> = {};
  let sanitizedText = text;
  for (const detection of [...detections].reverse()) {
    counts[detection.type] = (counts[detection.type] ?? 0) + 1;
    const index = indices[detection.type] ?? 0;
    indices[detection.type] = index + 1;
    const token = `[${labels[detection.type]}_${index}]`;
    sanitizedText = `${sanitizedText.slice(0, detection.start)}${token}${sanitizedText.slice(detection.end)}`;
  }

  return {
    effect: "TOKENIZE",
    reasonCode: "sensitive_data_tokenized_locally",
    detections,
    sanitizedText,
    counts,
  };
}

export function createBrowserAuditEvent(input: {
  organizationId: string;
  action: BrowserAuditEvent["action"];
  decision: BrowserProtectionDecision;
  host: string;
  selector: string;
  promptLength: number;
}): BrowserAuditEvent {
  return {
    organizationId: input.organizationId,
    module: "browser-protect",
    action: input.action,
    eventType: "browser.protection_decision",
    decision: input.decision.effect,
    status: input.decision.effect === "ALLOW" || input.decision.effect === "TOKENIZE" ? "allowed" : "blocked",
    detectionCounts: input.decision.counts,
    metadata: {
      host: input.host,
      selector: input.selector,
      promptLength: input.promptLength,
    },
  };
}

function dedupe(detections: BrowserDetection[]) {
  const accepted: BrowserDetection[] = [];
  for (const detection of detections.sort((a, b) => a.start - b.start || b.confidence - a.confidence)) {
    if (!accepted.some((prior) => detection.start < prior.end && detection.end > prior.start)) {
      accepted.push(detection);
    }
  }
  return accepted;
}

function passesLuhn(value: string) {
  const digits = value.replace(/\D/gu, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}
