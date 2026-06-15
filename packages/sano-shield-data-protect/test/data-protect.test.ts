import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  defaultDataProtectionPolicy,
  sanitizeRows,
  SqlRejectedError,
  validateSelectSql,
} from "../src/index.js";

describe("Data Protect SQL guard", () => {
  it("allows explicit SELECT queries and enforces row limits", () => {
    expect(
      validateSelectSql("SELECT name, email, salary FROM employees LIMIT 1000", defaultDataProtectionPolicy),
    ).toMatchObject({
      table: "employees",
      projectedColumns: ["name", "email", "salary"],
      limit: 100,
      normalizedSql: "SELECT name, email, salary FROM employees LIMIT 100",
    });
  });

  it("rejects broad or dangerous SQL", () => {
    expect(() => validateSelectSql("SELECT * FROM employees", defaultDataProtectionPolicy)).toThrow(
      SqlRejectedError,
    );
    expect(() =>
      validateSelectSql("SELECT name FROM employees; DROP TABLE employees", defaultDataProtectionPolicy),
    ).toThrow(SqlRejectedError);
    expect(() =>
      validateSelectSql("DELETE FROM employees WHERE id = 1", defaultDataProtectionPolicy),
    ).toThrow(SqlRejectedError);
  });

  it("masks, blocks and tokenizes result columns", () => {
    const result = sanitizeRows({
      table: "employees",
      columns: ["name", "email", "salary", "credit_card"],
      rows: [
        {
          name: "Ana",
          email: "ana@empresa.com",
          salary: 120000,
          credit_card: "4111111111111111",
        },
      ],
      policy: defaultDataProtectionPolicy,
    });

    expect(result.columns).toEqual(["name", "email", "credit_card"]);
    expect(result.rows[0]).toMatchObject({
      name: "Ana",
      email: "a***@empresa.com",
      credit_card: expect.stringMatching(/^SANO_DATA_TOKEN_/u),
    });
    expect(result.rows[0]).not.toHaveProperty("salary");
    expect(result.counts).toMatchObject({ email: 1, payment_card: 1, generic: 1 });
    expect(result.tokenizedCells[0]).toMatchObject({ original: "4111111111111111" });
  });

  it("parses simple queries within the local overhead budget", () => {
    const samples: number[] = [];
    for (let index = 0; index < 2_000; index += 1) {
      const startedAt = performance.now();
      validateSelectSql("SELECT name, email FROM employees WHERE id = $1", defaultDataProtectionPolicy);
      samples.push(performance.now() - startedAt);
    }
    const p95 = samples.sort((left, right) => left - right)[Math.floor(samples.length * 0.95)] ?? 99;
    expect(p95).toBeLessThan(3);
  });
});
