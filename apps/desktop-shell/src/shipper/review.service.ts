import { logger } from "../utils/logger";
import type { ReviewFinding, ReviewResult, ReviewSeverity } from "./ship-pipeline.types";

type FileReader = (path: string) => Promise<string | null>;

type ReviewRule = {
  id: string;
  severity: ReviewSeverity;
  test: (content: string, filePath: string) => ReviewFinding[];
};

const RULES: ReviewRule[] = [
  {
    id: "no-hardcoded-secrets",
    severity: "critical",
    test: (content, file) => {
      const patterns = [
        { regex: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi, msg: "Hardcoded secret detected" },
        { regex: /(?:sk_live|sk_test|pk_live|pk_test)_[a-zA-Z0-9]{20,}/g, msg: "Stripe key detected in source code" },
        { regex: /ghp_[a-zA-Z0-9]{36}/g, msg: "GitHub personal access token detected" },
        { regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, msg: "JWT token hardcoded in source" },
      ];
      const findings: ReviewFinding[] = [];
      for (const { regex, msg } of patterns) {
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue;
          if (regex.test(line) && !file.includes(".env.example")) {
            findings.push({ file, line: i + 1, severity: "critical", message: msg, fix: "Move to environment variables (.env)" });
          }
          regex.lastIndex = 0;
        }
      }
      return findings;
    },
  },
  {
    id: "no-eval",
    severity: "critical",
    test: (content, file) => {
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/\beval\s*\(/u.test(line) && !line.trimStart().startsWith("//")) {
          findings.push({ file, line: i + 1, severity: "critical", message: "eval() is a code injection vulnerability", fix: "Use JSON.parse() or a safer alternative" });
        }
      }
      return findings;
    },
  },
  {
    id: "no-innerhtml",
    severity: "critical",
    test: (content, file) => {
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return [];
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/dangerouslySetInnerHTML/u.test(line)) {
          findings.push({ file, line: i + 1, severity: "critical", message: "dangerouslySetInnerHTML is an XSS vulnerability risk", fix: "Sanitize HTML with DOMPurify or use safe rendering" });
        }
      }
      return findings;
    },
  },

  {
    id: "no-console-log",
    severity: "warning",
    test: (content, file) => {
      if (file.includes(".test.") || file.includes(".spec.") || file.includes("logger")) return [];
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/\bconsole\.(log|warn|error|debug)\b/u.test(line) && !line.trimStart().startsWith("//")) {
          findings.push({ file, line: i + 1, severity: "warning", message: "console.log left in production code", fix: "Use a structured logger instead" });
        }
      }
      return findings;
    },
  },
  {
    id: "no-any-type",
    severity: "suggestion",
    test: (content, file) => {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) return [];
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/:\s*any\b/u.test(line) && !line.includes("// eslint-disable")) {
          findings.push({ file, line: i + 1, severity: "suggestion", message: "Avoid using 'any' type — use a specific type or 'unknown'", fix: "Replace 'any' with a proper type annotation" });
        }
      }
      return findings;
    },
  },
  {
    id: "no-todo-in-production",
    severity: "warning",
    test: (content, file) => {
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/\b(TODO|FIXME|HACK|XXX)\b/u.test(line)) {
          findings.push({ file, line: i + 1, severity: "warning", message: "Unresolved TODO/FIXME found", fix: "Resolve or create an issue ticket before shipping" });
        }
      }
      return findings;
    },
  },

  {
    id: "no-sync-localstorage-in-render",
    severity: "warning",
    test: (content, file) => {
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return [];
      const findings: ReviewFinding[] = [];
      const lines = content.split("\n");
      let inComponent = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (/^export\s+(default\s+)?function\s+\w/u.test(line)) inComponent = true;
        if (inComponent && /localStorage\.(getItem|setItem)/u.test(line) && !/useEffect/u.test(content.slice(0, content.indexOf(line)))) {
          findings.push({ file, line: i + 1, severity: "warning", message: "Synchronous localStorage in render path blocks the main thread", fix: "Move to useEffect or a custom hook" });
        }
      }
      return findings;
    },
  },

  {
    id: "missing-error-boundary",
    severity: "suggestion",
    test: (content, file) => {
      if (!file.endsWith("layout.tsx") && !file.endsWith("Layout.tsx")) return [];
      if (!content.includes("ErrorBoundary") && !content.includes("error.tsx")) {
        return [{ file, line: 1, severity: "suggestion", message: "Layout missing an error boundary", fix: "Add an error.tsx file or wrap children with ErrorBoundary" }];
      }
      return [];
    },
  },
  {
    id: "missing-loading-state",
    severity: "suggestion",
    test: (content, file) => {
      if (!file.endsWith("page.tsx") && !file.endsWith("Page.tsx")) return [];
      if (content.includes("async") && !content.includes("loading") && !content.includes("Suspense")) {
        return [{ file, line: 1, severity: "suggestion", message: "Async page without loading state", fix: "Add a loading.tsx file or use React Suspense" }];
      }
      return [];
    },
  },
];

export class ReviewService {
  public async review(
    filePaths: string[],
    readFile: FileReader,
  ): Promise<ReviewResult> {
    const allFindings: ReviewFinding[] = [];
    let autoFixedCount = 0;

    for (const filePath of filePaths) {
      if (!isSourceFile(filePath)) continue;

      const content = await readFile(filePath);
      if (!content) continue;

      for (const rule of RULES) {
        try {
          const findings = rule.test(content, filePath);
          allFindings.push(...findings);
        } catch (err) {
          logger.warn("ReviewService", `Rule ${rule.id} threw on ${filePath}`, err);
        }
      }
    }

    const severityOrder: Record<ReviewSeverity, number> = { critical: 0, warning: 1, suggestion: 2 };
    allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const criticalCount = allFindings.filter(f => f.severity === "critical").length;
    const warningCount = allFindings.filter(f => f.severity === "warning").length;
    const score = Math.max(0, 100 - criticalCount * 25 - warningCount * 5 - allFindings.length);
    const passed = criticalCount === 0;

    logger.info("ReviewService", `Review complete: ${allFindings.length} findings, score=${score}, passed=${passed}`);

    return {
      passed,
      score,
      findings: allFindings,
      autoFixedCount,
      timestamp: new Date().toISOString(),
    };
  }
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path) && !path.includes("node_modules") && !path.includes(".next") && !path.includes("dist");
}
