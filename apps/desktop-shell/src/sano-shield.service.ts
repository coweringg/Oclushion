import { detectBrowserPii } from "@oclushion/browser-protect";
import { computeHmacSync, getHmacKey } from "./crypto/hmac";
import { PiiDetector } from "./security/pii-detector";

export type SanoShieldTokenMapping = {
  token: string;
  original: string;
  type: string;
};

export type SanoShieldSanitizeResult = {
  sanitizedText: string;
  mappings: SanoShieldTokenMapping[];
};

const labels: Record<string, string> = {
  email: "EMAIL",
  payment_card: "PAYMENT_CARD",
  api_key: "API_KEY",
  access_token: "ACCESS_TOKEN",
  private_key: "PRIVATE_KEY",
  jwt: "JWT_TOKEN",
  aws_key: "AWS_KEY",
  github_token: "GITHUB_TOKEN",
  ssh_key: "SSH_PRIVATE_KEY",
  connection_string: "CONNECTION_STRING",
  bearer_token: "BEARER_TOKEN",
  ip_address: "IP_ADDRESS",
  stripe_key: "STRIPE_KEY",
  npm_token: "NPM_TOKEN",
  sendgrid_key: "SENDGRID_KEY",
  slack_token: "SLACK_TOKEN",
  secret: "SECRET",
  password: "PASSWORD",
  token: "TOKEN",
  credential: "CREDENTIAL",
  encryption_key: "ENCRYPTION_KEY",
  session_id: "SESSION_ID",
  oauth_token: "OAUTH_TOKEN",
  hmac_key: "HMAC_KEY",
};

function generateNonce(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class SanoShield {
  private keyReady: Promise<void> | null = null;
  private piiDetector = new PiiDetector({ enableContextualDetection: true });

  public async init(): Promise<void> {
    this.keyReady = getHmacKey("pii").then(() => undefined);
    await this.keyReady;
  }

  public sanitize(text: string): SanoShieldSanitizeResult {
    const regexDetections = detectBrowserPii(text);
    const enhancedDetections = this.piiDetector.detectAll(text);

    const combined = [...regexDetections.map((d) => ({
      type: d.type,
      start: d.start,
      end: d.end,
    })), ...enhancedDetections.map((d) => ({
      type: d.type,
      start: d.start,
      end: d.end,
    }))];

    if (combined.length === 0) {
      return { sanitizedText: text, mappings: [] };
    }

    combined.sort((a, b) => b.start - a.start);

    const merged = combined.filter((detection, index) => {
      if (index === 0) return true;
      const prev = combined[index - 1];
      return !prev || detection.start !== prev.start || detection.end !== prev.end;
    });

    const mappings: SanoShieldTokenMapping[] = [];
    let sanitizedText = text;

    for (const detection of merged) {
      const label = labels[detection.type] ?? detection.type.toUpperCase();
      const nonce = generateNonce();
      const original = text.slice(detection.start, detection.end);
      const hmac = computeHmacSync(`${label}:${nonce}:${original}`, "pii");
      if (!hmac) {
        throw new Error("SanoShield: HMAC key not initialized. Call init() first.");
      }
      const token = `\u27E8PII:${label}:${nonce}:${hmac.slice(0, 16)}\u27E9`;
      mappings.unshift({ token, original, type: detection.type });
      sanitizedText = `${sanitizedText.slice(0, detection.start)}${token}${sanitizedText.slice(detection.end)}`;
    }

    return { sanitizedText, mappings };
  }

  public restore(text: string, mappings: readonly SanoShieldTokenMapping[]): string {
    return mappings.reduce(
      (current, mapping) => current.replaceAll(mapping.token, mapping.original),
      text,
    );
  }
}
