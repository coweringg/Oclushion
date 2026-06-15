export type PiiDetection = {
  type: string;
  label: string;
  start: number;
  end: number;
  text: string;
  confidence: "high" | "medium" | "low";
  method: "regex" | "heuristic" | "context";
};

export type PiiDetectorConfig = {
  enableContextualDetection?: boolean;
  customPatterns?: Array<{ type: string; label: string; pattern: RegExp }>;
};

const REGEX_PATTERNS: Array<{ type: string; label: string; pattern: RegExp }> = [
  { type: "jwt", label: "JWT_TOKEN", pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
  { type: "aws_key", label: "AWS_KEY", pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/g },
  { type: "github_token", label: "GITHUB_TOKEN", pattern: /ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/g },
  { type: "slack_token", label: "SLACK_TOKEN", pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g },
  { type: "pgp_key", label: "PGP_PRIVATE_KEY", pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g },
  { type: "connection_string", label: "CONNECTION_STRING", pattern: /(?:postgresql|mysql|mongodb|redis|rediss):\/\/[^\s"'<>]+/gi },
  { type: "aws_secret", label: "AWS_SECRET", pattern: /aws[_-]?secret[_-]?access[_-]?key['"]?\s*[:=]\s*['"]?[a-zA-Z0-9/+]{40}['"]?/gi },
  { type: "bearer_token", label: "BEARER_TOKEN", pattern: /bearer\s+[a-zA-Z0-9_.\-]{20,}/gi },
  { type: "basic_auth", label: "BASIC_AUTH", pattern: /basic\s+[a-zA-Z0-9=]{20,}/gi },
  { type: "docker_token", label: "DOCKER_TOKEN", pattern: /dckr_pat_[a-zA-Z0-9_\-]{26,}/gi },
  { type: "google_key", label: "GOOGLE_KEY", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { type: "heroku_key", label: "HEROKU_KEY", pattern: /heroku[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi },
  { type: "sauce_key", label: "SAUCE_KEY", pattern: /sauce[0-9a-f]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi },
  { type: "stripe_key", label: "STRIPE_KEY", pattern: /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{24,}/gi },
  { type: "sendgrid_key", label: "SENDGRID_KEY", pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/g },
  { type: "ip_address", label: "IP_ADDRESS", pattern: /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g },
  { type: "private_key", label: "PRIVATE_KEY", pattern: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH)?\s*PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA|EC|DSA|OPENSSH)?\s*PRIVATE\s+KEY-----/g },
  { type: "npm_token", label: "NPM_TOKEN", pattern: /npm_[a-zA-Z0-9]{36}/g },
  { type: "twilio_key", label: "TWILIO_KEY", pattern: /SK[a-f0-9]{32}/g },
];

const CONTEXT_KEYWORDS = [
  { words: ["password", "passwd", "pwd"], types: ["password"] },
  { words: ["secret", "secrets"], types: ["secret"] },
  { words: ["api[_-]?key", "apikey", "api_key"], types: ["api_key"] },
  { words: ["token", "auth[_-]?token", "access[_-]?token", "refresh[_-]?token"], types: ["token"] },
  { words: ["credential", "creds"], types: ["credential"] },
  { words: ["cipher", "encrypt", "decrypt"], types: ["encryption_key"] },
  { words: ["db[_-]?url", "database[_-]?url", "connection[_-]?string"], types: ["connection_string"] },
  { words: ["secret[_-]?key", "secret_key"], types: ["secret_key"] },
  { words: ["private[_-]?key"], types: ["private_key"] },
  { words: ["session[_-]?id", "session_id"], types: ["session_id"] },
  { words: ["oauth", "oauth[_-]?token"], types: ["oauth_token"] },
  { words: ["license[_-]?key", "licence"], types: ["license_key"] },
  { words: ["hmac", "hmac[_-]?key"], types: ["hmac_key"] },
  { words: ["salt"], types: ["salt"] },
  { words: ["certificate", "cert"], types: ["certificate"] },
];

export class PiiDetector {
  private readonly patterns: Array<{ type: string; label: string; pattern: RegExp }>;
  private readonly enableContextual: boolean;

  public constructor(config: PiiDetectorConfig = {}) {
    this.patterns = [...REGEX_PATTERNS, ...(config.customPatterns ?? [])];
    this.enableContextual = config.enableContextualDetection ?? true;
  }

  public detectAll(text: string): PiiDetection[] {
    const detections: PiiDetection[] = [];
    const seen = new Set<number>();

    for (const { type, label, pattern } of this.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match.index !== undefined && !seen.has(match.index)) {
          seen.add(match.index);
          detections.push({
            type,
            label,
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
            confidence: "high",
            method: "regex",
          });
        }
      }
    }

    if (this.enableContextual) {
      this.detectContextual(text, detections, seen);
    }

    detections.sort((a, b) => a.start - b.start);
    return this.mergeOverlapping(detections);
  }

  private detectContextual(text: string, detections: PiiDetection[], seen: Set<number>): void {
    const lines = text.split("\n");
    let lineOffset = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        lineOffset += line.length + 1;
        continue;
      }

      const matchedContexts = CONTEXT_KEYWORDS.filter(({ words }) =>
        words.some((w) => new RegExp(`(?:^|[^a-zA-Z0-9])${w}(?:$|[^a-zA-Z0-9])`, "i").test(trimmedLine)),
      );

      if (matchedContexts.length > 0) {
        const types = matchedContexts.flatMap((m) => m.types);
        const assignmentMatch = trimmedLine.match(/[:=]\s*(.+)$/);
        if (assignmentMatch) {
          const value = assignmentMatch[1].trim();
          const colonIndex = trimmedLine.indexOf(assignmentMatch[0]);
          const eqIndex = trimmedLine.indexOf("=");
          const separatorIndex = eqIndex >= 0 ? eqIndex : colonIndex;
          const valueStart = lineOffset + separatorIndex + 1;
          if (value.length >= 8 && value.length <= 500 && !seen.has(valueStart) && !/^[0-9]+$/.test(value)) {
            seen.add(valueStart);
            detections.push({
              type: types[0],
              label: types[0].toUpperCase(),
              start: valueStart,
              end: valueStart + value.length,
              text: value,
              confidence: "medium",
              method: "context",
            });
          }
        }
      }

      lineOffset += line.length + 1;
    }
  }

  private isToken(text: string): boolean {
    return /^[a-zA-Z0-9_\-./+=:]{8,}$/.test(text) && !/^[0-9\s]+$/.test(text);
  }

  private mergeOverlapping(detections: PiiDetection[]): PiiDetection[] {
    if (detections.length <= 1) return detections;

    const merged: PiiDetection[] = [];
    let current = detections[0];

    for (let i = 1; i < detections.length; i++) {
      const next = detections[i];
      if (next.start <= current.end) {
        current = {
          ...current,
          end: Math.max(current.end, next.end),
          text: current.text.length >= next.text.length ? current.text : next.text,
          confidence: current.confidence === "high" || next.confidence === "high" ? "high" : "medium",
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
    return merged;
  }
}
