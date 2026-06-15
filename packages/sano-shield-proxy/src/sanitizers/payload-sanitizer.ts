import type { Detection, SensitiveEntityType } from "@oclushion/shared";

import type { TextDetector } from "../detectors/pii-client.js";

export type TokenMapping = Record<string, string>;

type SanitizationResult = {
  payload: unknown;
  mapping: TokenMapping;
  counts: Partial<Record<SensitiveEntityType, number>>;
};

export type PayloadInspection = {
  payload: unknown;
  spans: Array<{
    path: Array<string | number>;
    value: string;
    detections: Detection[];
  }>;
  detections: Array<{ type: SensitiveEntityType; confidence: number }>;
  counts: Partial<Record<SensitiveEntityType, number>>;
};

const tokenLabels: Record<SensitiveEntityType, string> = {
  person: "PERSON",
  email: "EMAIL",
  phone: "PHONE",
  payment_card: "PAYMENT_CARD",
  bank_account: "BANK_ACCOUNT",
  api_key: "API_KEY",
  access_token: "ACCESS_TOKEN",
  private_key: "PRIVATE_KEY",
};

const metadataStringKeys = new Set(["role", "model", "type", "name", "tool_choice"]);

export async function sanitizePayload(
  payload: unknown,
  detector: TextDetector,
  requestId: string,
): Promise<SanitizationResult> {
  return tokenizePayload(
    await inspectPayload(payload, detector, requestId),
    Object.keys(tokenLabels) as SensitiveEntityType[],
  );
}

export async function inspectPayload(
  payload: unknown,
  detector: TextDetector,
  requestId: string,
): Promise<PayloadInspection> {
  const spans: PayloadInspection["spans"] = [];
  const detections: PayloadInspection["detections"] = [];
  const counts: Partial<Record<SensitiveEntityType, number>> = {};

  const inspectValue = async (value: unknown, path: Array<string | number>, key?: string) => {
    if (typeof value === "string") {
      if (key && metadataStringKeys.has(key)) {
        return;
      }
      const accepted = normalizeDetections(await detector.analyze(requestId, value));
      if (accepted.length > 0) {
        spans.push({ path, value, detections: accepted });
        for (const detection of accepted) {
          detections.push({ type: detection.type, confidence: detection.confidence });
          counts[detection.type] = (counts[detection.type] ?? 0) + 1;
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      await Promise.all(
        value.map(async (item, index) => inspectValue(item, [...path, index])),
      );
      return;
    }
    if (isRecord(value)) {
      await Promise.all(
        Object.entries(value).map(async ([entryKey, item]) =>
          inspectValue(item, [...path, entryKey], entryKey),
        ),
      );
    }
  };

  await inspectValue(payload, []);
  return { payload, spans, detections, counts };
}

export function tokenizePayload(
  inspection: PayloadInspection,
  tokenizeEntityTypes: readonly SensitiveEntityType[],
): SanitizationResult {
  const mapping: TokenMapping = {};
  const counts: Partial<Record<SensitiveEntityType, number>> = {};
  const tokenIndices: Partial<Record<SensitiveEntityType, number>> = {};
  const allowedTypes = new Set(tokenizeEntityTypes);
  const spansByPath = new Map(
    inspection.spans.map((span) => [JSON.stringify(span.path), span]),
  );

  const sanitizeValue = (value: unknown, path: Array<string | number>): unknown => {
    if (typeof value === "string") {
      const span = spansByPath.get(JSON.stringify(path));
      if (!span) {
        return value;
      }
      let sanitized = value;

      for (const detection of [...span.detections].reverse()) {
        if (!allowedTypes.has(detection.type)) {
          continue;
        }
        const original = value.slice(detection.start, detection.end);
        let tokenIndex = tokenIndices[detection.type] ?? 0;
        let token = `[${tokenLabels[detection.type]}_${tokenIndex}]`;
        while (value.includes(token) || token in mapping) {
          tokenIndex += 1;
          token = `[${tokenLabels[detection.type]}_${tokenIndex}]`;
        }
        tokenIndices[detection.type] = tokenIndex + 1;
        counts[detection.type] = (counts[detection.type] ?? 0) + 1;
        mapping[token] = original;
        sanitized = sanitized.slice(0, detection.start) + token + sanitized.slice(detection.end);
      }

      return sanitized;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => sanitizeValue(item, [...path, index]));
    }

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, item]) => [
          entryKey,
          sanitizeValue(item, [...path, entryKey]),
        ]),
      );
    }

    return value;
  };

  return { payload: sanitizeValue(inspection.payload, []), mapping, counts };
}

export function reversePayload(payload: unknown, mapping: TokenMapping): unknown {
  if (typeof payload === "string") {
    return Object.entries(mapping).reduce(
      (text, [token, original]) => text.replaceAll(token, original),
      payload,
    );
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => reversePayload(item, mapping));
  }

  if (isRecord(payload)) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, reversePayload(value, mapping)]),
    );
  }

  return payload;
}

function normalizeDetections(detections: Detection[]): Detection[] {
  const sorted = [...detections].sort(
    (left, right) => left.start - right.start || right.confidence - left.confidence,
  );
  const accepted: Detection[] = [];

  for (const detection of sorted) {
    const isValid = detection.end > detection.start;
    const overlaps = accepted.some(
      (existing) => detection.start < existing.end && detection.end > existing.start,
    );
    if (isValid && !overlaps) {
      accepted.push(detection);
    }
  }

  return accepted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
