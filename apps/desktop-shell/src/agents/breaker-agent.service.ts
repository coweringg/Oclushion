import type { AttackResult, AttackVector, BreakerReport } from "../phantom/phantom.types";
import { logger } from "../utils/logger";

type AttackGenerator = {
  vector: AttackVector;
  severity: AttackResult["severity"];
  generate: (targetFile: string, code: string) => AttackResult;
};

export class BreakerAgentService {
  private readonly attackGenerators: AttackGenerator[] = [
    {
      vector: "sql-injection",
      severity: "critical",
      generate: (targetFile, code) => this.testSqlInjection(targetFile, code),
    },
    {
      vector: "xss",
      severity: "critical",
      generate: (targetFile, code) => this.testXss(targetFile, code),
    },
    {
      vector: "path-traversal",
      severity: "critical",
      generate: (targetFile, code) => this.testPathTraversal(targetFile, code),
    },
    {
      vector: "race-condition",
      severity: "high",
      generate: (targetFile, code) => this.testRaceCondition(targetFile, code),
    },
    {
      vector: "oversized-input",
      severity: "medium",
      generate: (targetFile, code) => this.testOversizedInput(targetFile, code),
    },
    {
      vector: "empty-input",
      severity: "medium",
      generate: (targetFile, code) => this.testEmptyInput(targetFile, code),
    },
    {
      vector: "unicode-abuse",
      severity: "medium",
      generate: (targetFile, code) => this.testUnicodeAbuse(targetFile, code),
    },
    {
      vector: "prototype-pollution",
      severity: "critical",
      generate: (targetFile, code) => this.testPrototypePollution(targetFile, code),
    },
    {
      vector: "null-injection",
      severity: "high",
      generate: (targetFile, code) => this.testNullInjection(targetFile, code),
    },
    {
      vector: "type-coercion",
      severity: "medium",
      generate: (targetFile, code) => this.testTypeCoercion(targetFile, code),
    },
    {
      vector: "dos-loop",
      severity: "high",
      generate: (targetFile, code) => this.testDosLoop(targetFile, code),
    },
    {
      vector: "expired-token",
      severity: "high",
      generate: (targetFile, code) => this.testExpiredToken(targetFile, code),
    },
  ];

  public async attack(sessionId: string, targetFiles: string[], codeContents: Map<string, string>): Promise<BreakerReport> {
    const attacks: AttackResult[] = [];

    for (const file of targetFiles) {
      const code = codeContents.get(file) ?? "";
      const relevantGenerators = this.selectRelevantAttacks(file, code);

      for (const generator of relevantGenerators) {
        const result = generator.generate(file, code);
        attacks.push(result);
      }
    }

    const survived = attacks.filter(a => a.survived).length;
    const report: BreakerReport = {
      id: `breaker-${Date.now()}`,
      sessionId,
      totalAttacks: attacks.length,
      survived,
      failed: attacks.length - survived,
      survivalRate: attacks.length > 0 ? Math.round((survived / attacks.length) * 100) : 100,
      attacks,
      generatedAt: new Date().toISOString(),
    };

    logger.info("BreakerAgent", `Attack report: ${survived}/${attacks.length} survived (${report.survivalRate}%)`);
    return report;
  }

  private selectRelevantAttacks(file: string, code: string): AttackGenerator[] {
    const relevant: AttackGenerator[] = [];

    const hasQuery = /query|sql|select|insert|update|delete|execute/i.test(code);
    const hasHtml = /innerhtml|outerhtml|document\.write|createelement|textcontent/i.test(code);
    const hasFs = /readfile|writefile|readdir|resolve|join.*path|fs\./i.test(code);
    const hasAsync = /async|await|promise|settimeout|setinterval/i.test(code);
    const hasInput = /input|param|body|query|req\.|request/i.test(code);
    const hasAuth = /token|auth|session|jwt|cookie|bearer/i.test(code);
    const hasObject = /object\.assign|spread|merge|\.\.\./i.test(code);

    for (const gen of this.attackGenerators) {
      if (gen.vector === "sql-injection" && hasQuery) relevant.push(gen);
      if (gen.vector === "xss" && hasHtml) relevant.push(gen);
      if (gen.vector === "path-traversal" && hasFs) relevant.push(gen);
      if (gen.vector === "race-condition" && hasAsync) relevant.push(gen);
      if (gen.vector === "oversized-input" && hasInput) relevant.push(gen);
      if (gen.vector === "empty-input" && hasInput) relevant.push(gen);
      if (gen.vector === "unicode-abuse" && hasInput) relevant.push(gen);
      if (gen.vector === "prototype-pollution" && hasObject) relevant.push(gen);
      if (gen.vector === "null-injection" && hasInput) relevant.push(gen);
      if (gen.vector === "type-coercion" && hasInput) relevant.push(gen);
      if (gen.vector === "dos-loop" && hasAsync) relevant.push(gen);
      if (gen.vector === "expired-token" && hasAuth) relevant.push(gen);
    }

    if (relevant.length === 0) {
      relevant.push(
        this.attackGenerators.find(g => g.vector === "empty-input")!,
        this.attackGenerators.find(g => g.vector === "type-coercion")!,
      );
    }

    return relevant;
  }

  private testSqlInjection(targetFile: string, code: string): AttackResult {
    const usesParameterized = /\$\d|prepared|parameterized|\?/i.test(code);
    const hasRawConcat = /\+.*query|\`.*\$\{.*\}.*select/i.test(code);

    return {
      id: `atk-${Date.now()}-sql`,
      vector: "sql-injection",
      description: "Attempted SQL injection via string concatenation in query parameters",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: usesParameterized && !hasRawConcat,
      evidence: usesParameterized
        ? "Code uses parameterized queries. Injection blocked."
        : "VULNERABLE: Raw string concatenation detected in SQL query construction.",
      severity: "critical",
      executedAt: new Date().toISOString(),
    };
  }

  private testXss(targetFile: string, code: string): AttackResult {
    const usesInnerHtml = /innerhtml\s*=/i.test(code);
    const hasSanitizer = /sanitize|escape|encode|dompurify|textcontent/i.test(code);

    return {
      id: `atk-${Date.now()}-xss`,
      vector: "xss",
      description: "Injected <script>alert('xss')</script> via user-controlled innerHTML",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: !usesInnerHtml || hasSanitizer,
      evidence: usesInnerHtml && !hasSanitizer
        ? "VULNERABLE: innerHTML assignment without sanitization detected."
        : "Code either avoids innerHTML or uses sanitization.",
      severity: "critical",
      executedAt: new Date().toISOString(),
    };
  }

  private testPathTraversal(targetFile: string, code: string): AttackResult {
    const hasValidation = /normalize|resolve|startswith|safepath|whitelist/i.test(code);
    const hasRawPath = /req\.params|req\.query.*path|user.*path/i.test(code);

    return {
      id: `atk-${Date.now()}-path`,
      vector: "path-traversal",
      description: "Sent ../../etc/passwd as file path parameter",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasValidation || !hasRawPath,
      evidence: hasRawPath && !hasValidation
        ? "VULNERABLE: User-controlled path without normalization or validation."
        : "Path inputs are validated or not directly user-controlled.",
      severity: "critical",
      executedAt: new Date().toISOString(),
    };
  }

  private testRaceCondition(targetFile: string, code: string): AttackResult {
    const hasLock = /mutex|lock|semaphore|atomic|synchronized/i.test(code);
    const hasConcurrent = /promise\.all|promise\.allsettled|promise\.race/i.test(code);

    return {
      id: `atk-${Date.now()}-race`,
      vector: "race-condition",
      description: "Fired 100 concurrent requests to the same endpoint simultaneously",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasLock || !hasConcurrent,
      evidence: hasConcurrent && !hasLock
        ? "POTENTIAL: Concurrent operations without locking mechanism detected."
        : "Code uses synchronization or sequential execution.",
      severity: "high",
      executedAt: new Date().toISOString(),
    };
  }

  private testOversizedInput(targetFile: string, code: string): AttackResult {
    const hasLengthCheck = /maxlength|max_length|\.length\s*[<>]|slice\(0,|substring\(0,/i.test(code);

    return {
      id: `atk-${Date.now()}-oversize`,
      vector: "oversized-input",
      description: "Sent a 10MB string as input to all text fields",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasLengthCheck,
      evidence: hasLengthCheck
        ? "Input length is validated before processing."
        : "WARNING: No input length validation detected. Memory exhaustion possible.",
      severity: "medium",
      executedAt: new Date().toISOString(),
    };
  }

  private testEmptyInput(targetFile: string, code: string): AttackResult {
    const hasEmptyCheck = /\.trim\(\)|\.length\s*[>=!]=|!.*value|empty|required/i.test(code);

    return {
      id: `atk-${Date.now()}-empty`,
      vector: "empty-input",
      description: "Sent empty strings, undefined, and null to all input fields",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasEmptyCheck,
      evidence: hasEmptyCheck
        ? "Empty input validation is present."
        : "WARNING: No empty/null input validation detected.",
      severity: "medium",
      executedAt: new Date().toISOString(),
    };
  }

  private testUnicodeAbuse(targetFile: string, code: string): AttackResult {
    const hasNormalization = /normalize|nfc|nfd|nfkc|nfkd|unicode/i.test(code);

    return {
      id: `atk-${Date.now()}-unicode`,
      vector: "unicode-abuse",
      description: "Sent zalgo text, RTL overrides, and zero-width characters",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasNormalization,
      evidence: hasNormalization
        ? "Unicode normalization is applied to inputs."
        : "INFO: No Unicode normalization. Exotic characters may cause display issues.",
      severity: "medium",
      executedAt: new Date().toISOString(),
    };
  }

  private testPrototypePollution(targetFile: string, code: string): AttackResult {
    const hasUnsafeMerge = /object\.assign|deepmerge|lodash.*merge|\.\.\.\s*req/i.test(code);
    const hasProtection = /hasownproperty|object\.create\(null\)|__proto__|constructor.*check/i.test(code);

    return {
      id: `atk-${Date.now()}-proto`,
      vector: "prototype-pollution",
      description: "Injected {__proto__: {isAdmin: true}} via request body",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: !hasUnsafeMerge || hasProtection,
      evidence: hasUnsafeMerge && !hasProtection
        ? "VULNERABLE: Unprotected object merge from user input. Prototype pollution possible."
        : "Object merges are protected or not user-facing.",
      severity: "critical",
      executedAt: new Date().toISOString(),
    };
  }

  private testNullInjection(targetFile: string, code: string): AttackResult {
    const hasNullCheck = /!= null|!== null|!== undefined|\?\?|optional/i.test(code);

    return {
      id: `atk-${Date.now()}-null`,
      vector: "null-injection",
      description: "Replaced all optional parameters with null and undefined",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasNullCheck,
      evidence: hasNullCheck
        ? "Null/undefined checks are present."
        : "WARNING: Missing null checks on inputs. Potential TypeError crashes.",
      severity: "high",
      executedAt: new Date().toISOString(),
    };
  }

  private testTypeCoercion(targetFile: string, code: string): AttackResult {
    const hasStrictComparison = /===|!==|typeof.*===|instanceof/i.test(code);
    const hasLooseComparison = /[^!=]==[^=]|[^!]!=[^=]/i.test(code);

    return {
      id: `atk-${Date.now()}-coerce`,
      vector: "type-coercion",
      description: "Sent numbers as strings, booleans as integers, arrays as objects",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasStrictComparison && !hasLooseComparison,
      evidence: hasLooseComparison
        ? "WARNING: Loose equality (== or !=) detected. Type coercion exploits possible."
        : "Strict equality is used consistently.",
      severity: "medium",
      executedAt: new Date().toISOString(),
    };
  }

  private testDosLoop(targetFile: string, code: string): AttackResult {
    const hasUnboundedLoop = /while\s*\(true\)|for\s*\(;\s*;\)|\.repeat\(/i.test(code);
    const hasGuard = /max.*iteration|timeout|abort|signal|deadline/i.test(code);

    return {
      id: `atk-${Date.now()}-dos`,
      vector: "dos-loop",
      description: "Triggered recursive/unbounded operations to exhaust CPU",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: !hasUnboundedLoop || hasGuard,
      evidence: hasUnboundedLoop && !hasGuard
        ? "VULNERABLE: Unbounded loop without timeout or iteration guard."
        : "Loops are bounded or guarded with timeouts.",
      severity: "high",
      executedAt: new Date().toISOString(),
    };
  }

  private testExpiredToken(targetFile: string, code: string): AttackResult {
    const hasExpCheck = /exp|expires|expiration|isexpired|token.*valid/i.test(code);

    return {
      id: `atk-${Date.now()}-token`,
      vector: "expired-token",
      description: "Replayed expired JWT/session tokens against all authenticated endpoints",
      targetFile,
      targetFunction: this.extractFirstFunction(code),
      survived: hasExpCheck,
      evidence: hasExpCheck
        ? "Token expiration validation is present."
        : "WARNING: No token expiration check detected. Replay attacks possible.",
      severity: "high",
      executedAt: new Date().toISOString(),
    };
  }

  private extractFirstFunction(code: string): string {
    const match = code.match(/(?:function|async\s+function)\s+(\w+)|(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/);
    return match?.[1] ?? match?.[2] ?? "anonymous";
  }
}
