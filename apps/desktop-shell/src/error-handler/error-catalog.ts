export type ErrorCode = `ERR-${string}-${number}`;

export type ErrorAction = {
  label: string;
  type: "link" | "button";
  href?: string;
  action?: () => void;
};

export type UserFriendlyError = {
  code: ErrorCode;
  type: ErrorType;
  title: string;
  message: string;
  explanation: string;
  action: ErrorAction | null;
  docsUrl: string | null;
  retryable: boolean;
};

export type ErrorType =
  | "network"
  | "auth"
  | "rate_limit"
  | "server"
  | "validation"
  | "permission"
  | "config"
  | "unknown";

type ErrorMatch = {
  patterns: string[];
  code: ErrorCode;
  type: ErrorType;
  title: string;
  explanation: string;
  action: ErrorAction | null;
  docsUrl: string | null;
  retryable: boolean;
};

const ERROR_MATCHES: ErrorMatch[] = [
  {
    patterns: ["401", "unauthorized", "invalid api key", "api key not found"],
    code: "ERR-AUTH-001",
    type: "auth",
    title: "Credentials Incorrect",
    explanation: "Check your email and password and try again. Forgot your password? You can reset it.",
    action: { label: "Open Settings", type: "link", href: "#settings" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-AUTH-001",
    retryable: false,
  },
  {
    patterns: ["403", "forbidden", "not allowed", "insufficient permissions"],
    code: "ERR-AUTH-002",
    type: "permission",
    title: "Access Denied",
    explanation: "You don't have permission to perform this action. Contact your organization admin to request access.",
    action: { label: "Request Access", type: "link", href: "#settings/members" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-AUTH-002",
    retryable: false,
  },
  {
    patterns: ["session expired", "token expired", "jwt expired"],
    code: "ERR-AUTH-003",
    type: "auth",
    title: "Session Expired",
    explanation: "Your session has expired. Please sign in again to continue.",
    action: { label: "Sign In Again", type: "link", href: "/login" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-AUTH-003",
    retryable: true,
  },
  {
    patterns: ["login failed", "sign in failed", "invalid credentials", "wrong password"],
    code: "ERR-AUTH-004",
    type: "auth",
    title: "Sign In Failed",
    explanation: "The email or password you entered is incorrect. Try again or reset your password.",
    action: { label: "Reset Password", type: "link", href: "#reset-password" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-AUTH-004",
    retryable: false,
  },

  {
    patterns: ["fetch", "network", "enotfound", "econnrefused", "econnreset", "socket hang up"],
    code: "ERR-NET-001",
    type: "network",
    title: "Connection Failed",
    explanation: "Could not connect to the server. Check your internet connection. If you use a corporate proxy, configure it in Settings > Network.",
    action: { label: "Check Network", type: "link", href: "#settings/network" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-NET-001",
    retryable: true,
  },
  {
    patterns: ["timeout", "timed out", "etimedout"],
    code: "ERR-NET-002",
    type: "network",
    title: "Request Timed Out",
    explanation: "The server took too long to respond. This is usually temporary — try again.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-NET-002",
    retryable: true,
  },
  {
    patterns: ["dns"],
    code: "ERR-NET-003",
    type: "network",
    title: "DNS Resolution Failed",
    explanation: "Could not resolve the server address. Check your DNS settings or try again later.",
    action: { label: "Check DNS", type: "link", href: "#settings/network" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-NET-003",
    retryable: true,
  },
  {
    patterns: ["cors", "cross-origin"],
    code: "ERR-NET-004",
    type: "network",
    title: "CORS Error",
    explanation: "A cross-origin request was blocked. This is typically a server configuration issue.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-NET-004",
    retryable: false,
  },

  {
    patterns: ["429", "rate limit", "too many requests", "quota exceeded"],
    code: "ERR-RATE-001",
    type: "rate_limit",
    title: "Rate Limit Exceeded",
    explanation: "You've sent too many requests. Wait a moment and try again, or upgrade your plan for higher limits.",
    action: { label: "View Plans", type: "link", href: "#pricing" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-RATE-001",
    retryable: true,
  },

  {
    patterns: ["500", "internal server error"],
    code: "ERR-SRV-001",
    type: "server",
    title: "Server Error",
    explanation: "The server encountered an internal error. This is usually temporary — please try again.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-SRV-001",
    retryable: true,
  },
  {
    patterns: ["502", "bad gateway"],
    code: "ERR-SRV-002",
    type: "server",
    title: "Bad Gateway",
    explanation: "The server received an invalid response from an upstream service. Please try again.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-SRV-002",
    retryable: true,
  },
  {
    patterns: ["503", "service unavailable"],
    code: "ERR-SRV-003",
    type: "server",
    title: "Service Unavailable",
    explanation: "The service is temporarily unavailable, possibly due to maintenance. Please try again later.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-SRV-003",
    retryable: true,
  },
  {
    patterns: ["504", "gateway timeout"],
    code: "ERR-SRV-004",
    type: "server",
    title: "Gateway Timeout",
    explanation: "An upstream service timed out. Try again, or contact support if it persists.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-SRV-004",
    retryable: true,
  },

  {
    patterns: ["validation", "invalid input", "bad request", "400"],
    code: "ERR-VAL-001",
    type: "validation",
    title: "Invalid Input",
    explanation: "The input provided was not valid. Check the field values and try again.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-VAL-001",
    retryable: false,
  },
  {
    patterns: ["schema", "required"],
    code: "ERR-VAL-002",
    type: "validation",
    title: "Missing Required Field",
    explanation: "A required field is missing. Fill in all required fields and try again.",
    action: null,
    docsUrl: "https://oclushion.com/docs/errors/ERR-VAL-002",
    retryable: false,
  },

  {
    patterns: ["api key not configured", "no api key", "missing api key", "provider not configured"],
    code: "ERR-CFG-001",
    type: "config",
    title: "API Key Missing",
    explanation: "No API key is configured for this provider. Add your API key in Settings to continue.",
    action: { label: "Configure API Key", type: "link", href: "#settings/keys" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-CFG-001",
    retryable: false,
  },
  {
    patterns: ["git not found", "git is not installed"],
    code: "ERR-CFG-002",
    type: "config",
    title: "Git Not Found",
    explanation: "Git is not installed or not in your PATH. Install Git to use version control features.",
    action: { label: "Install Git", type: "link", href: "https://git-scm.com/downloads" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-CFG-002",
    retryable: false,
  },
  {
    patterns: ["workspace not found", "no workspace"],
    code: "ERR-CFG-003",
    type: "config",
    title: "Workspace Error",
    explanation: "Could not find or open the workspace. Check the path and try again.",
    action: { label: "Workspace Settings", type: "link", href: "#settings/workspace" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-CFG-003",
    retryable: false,
  },

  {
    patterns: ["god mode required", "requires god mode", "command blocked"],
    code: "ERR-PERM-001",
    type: "permission",
    title: "Command Requires God Mode",
    explanation: "This command requires God Mode to execute. Enable it in Security Settings to proceed.",
    action: { label: "Enable God Mode", type: "link", href: "#settings/security" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-PERM-001",
    retryable: false,
  },
  {
    patterns: ["command not allowed", "execution denied", "not in allowlist"],
    code: "ERR-PERM-002",
    type: "permission",
    title: "Command Not Allowed",
    explanation: "This command is not in your allowed list. Contact your admin or update the security policy.",
    action: { label: "Security Policy", type: "link", href: "#settings/security" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-PERM-002",
    retryable: false,
  },

  {
    patterns: ["pii detected", "sensitive data", "tokenization failed"],
    code: "ERR-PII-001",
    type: "validation",
    title: "Sensitive Data Detected",
    explanation: "Sensitive data was detected in your request and was blocked. Oclushion's SanoShield protects your privacy.",
    action: { label: "Learn More", type: "link", href: "https://oclushion.com/docs/security/pii" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-PII-001",
    retryable: false,
  },

  {
    patterns: ["payment failed", "card declined", "insufficient credits"],
    code: "ERR-BILL-001",
    type: "server",
    title: "Payment Error",
    explanation: "The payment could not be processed. Check your billing details and try again.",
    action: { label: "Update Billing", type: "link", href: "#settings/billing" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-BILL-001",
    retryable: true,
  },
  {
    patterns: ["trial expired", "subscription expired", "plan limit"],
    code: "ERR-BILL-002",
    type: "server",
    title: "Plan Limit Reached",
    explanation: "You've reached the limit of your current plan. Upgrade to continue using all features.",
    action: { label: "Upgrade Plan", type: "link", href: "#pricing" },
    docsUrl: "https://oclushion.com/docs/errors/ERR-BILL-002",
    retryable: false,
  },
];

const DEFAULT_USER_ERROR: UserFriendlyError = {
  code: "ERR-UNK-001",
  type: "unknown",
  title: "Something Went Wrong",
  message: "An unexpected error occurred.",
  explanation: "We're not sure what happened. Try again or contact support if the issue persists.",
  action: { label: "Contact Support", type: "link", href: "https://oclushion.com/support" },
  docsUrl: "https://oclushion.com/docs/errors/ERR-UNK-001",
  retryable: false,
};

export function matchError(originalMessage: string): ErrorMatch | null {
  const lower = originalMessage.toLowerCase();
  for (const entry of ERROR_MATCHES) {
    for (const pattern of entry.patterns) {
      if (lower.includes(pattern)) return entry;
    }
  }
  return null;
}

export function buildUserFriendlyError(
  originalError: Error,
): UserFriendlyError {
  const match = matchError(originalError.message);
  if (!match) return { ...DEFAULT_USER_ERROR, message: originalError.message };

  return {
    code: match.code,
    type: match.type,
    title: match.title,
    message: originalError.message,
    explanation: match.explanation,
    action: match.action,
    docsUrl: match.docsUrl,
    retryable: match.retryable,
  };
}
