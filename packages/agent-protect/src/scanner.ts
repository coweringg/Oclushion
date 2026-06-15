import path from "node:path";

import type { AgentWorkspacePolicy, SecretKind, TokenMapping } from "./types.js";

type SecretPattern = {
  kind: SecretKind;
  pattern: RegExp;
  label: string;
};

const secretPatterns: SecretPattern[] = [
  { kind: "private_key", label: "PRIVATEKEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { kind: "api_key", label: "APIKEY", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/g },
  { kind: "access_token", label: "ACCESSTOKEN", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { kind: "database_url", label: "DATABASEURL", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb):\/\/[^\s"'`<>]+/g },
  { kind: "password", label: "PASSWORD", pattern: /\b(?:password|passwd|pwd|secret)\s*[:=]\s*["']?[^"'\s]{8,}/gi },
];

export function shouldIgnoreDirectory(name: string, policy: AgentWorkspacePolicy) {
  return policy.ignoredDirectories.includes(name);
}

export function classifyFile(relativePath: string, bytes: number, policy: AgentWorkspacePolicy) {
  const base = path.basename(relativePath);
  const extension = path.extname(relativePath).toLowerCase();

  if (policy.blockedFileNames.includes(base)) {
    return { blocked: true, reason: "blocked_file_name" };
  }
  if (policy.blockedExtensions.includes(extension)) {
    return { blocked: true, reason: "blocked_extension" };
  }
  if (bytes > policy.maxFileBytes) {
    return { blocked: true, reason: "file_too_large" };
  }
  return { blocked: false };
}

export function sanitizeContent(relativePath: string, content: string) {
  const mappings: TokenMapping[] = [];
  let sanitized = content;
  const counters = new Map<string, number>();

  for (const { kind, label, pattern } of secretPatterns) {
    sanitized = sanitized.replace(pattern, (original) => {
      const index = counters.get(kind) ?? 0;
      counters.set(kind, index + 1);
      const token = `SANO_TOKEN_${label}_${index}`;
      mappings.push({ token, original, kind, relativePath });
      return token;
    });
  }

  return { sanitized, mappings };
}

export function restoreTokens(content: string, mappings: readonly TokenMapping[]) {
  return mappings.reduce(
    (current, mapping) => current.replaceAll(mapping.token, mapping.original),
    content,
  );
}
