import { request } from "undici";

import { analyzeTextRequestSchema, analyzeTextResponseSchema, type Detection } from "@oclushion/shared";

export interface TextDetector {
  analyze(requestId: string, text: string): Promise<Detection[]>;
}

export class HttpPiiDetectorClient implements TextDetector {
  public constructor(private readonly baseUrl: string) {}

  public async analyze(requestId: string, text: string): Promise<Detection[]> {
    const payload = analyzeTextRequestSchema.parse({ requestId, text });
    const response = await request(new URL("/v1/analyze", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`PII service returned status ${response.statusCode}.`);
    }

    const result = analyzeTextResponseSchema.parse(await response.body.json());
    return result.detections;
  }
}

type LocalRecognizer = {
  type: Detection["type"];
  pattern: RegExp;
};

const localRecognizers: LocalRecognizer[] = [
  { type: "api_key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g },
  { type: "access_token", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { type: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

export class LocalSecretDetector implements TextDetector {
  public async analyze(_requestId: string, text: string): Promise<Detection[]> {
    return localRecognizers.flatMap(({ type, pattern }) =>
      [...text.matchAll(pattern)].flatMap((match) => {
        if (match.index === undefined) {
          return [];
        }

        return [{ type, start: match.index, end: match.index + match[0].length, confidence: 1 }];
      }),
    );
  }
}

export class CompositeDetector implements TextDetector {
  public constructor(private readonly detectors: TextDetector[]) {}

  public async analyze(requestId: string, text: string): Promise<Detection[]> {
    const results = await Promise.all(
      this.detectors.map(async (detector) => detector.analyze(requestId, text)),
    );

    return deduplicateDetections(results.flat());
  }
}

function deduplicateDetections(detections: Detection[]): Detection[] {
  const bestByRange = new Map<string, Detection>();

  for (const detection of detections) {
    const key = `${detection.start}:${detection.end}`;
    const prior = bestByRange.get(key);
    if (!prior || prior.confidence < detection.confidence) {
      bestByRange.set(key, detection);
    }
  }

  return [...bestByRange.values()];
}
