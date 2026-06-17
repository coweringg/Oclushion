/**
 * This fixture documents the syntactically-invalid TypeScript patterns
 * that parser recovery tests exercise. The test source is passed inline
 * in parser_tests.rs (`test_parse_malformed_code_with_recovery`), so
 * this file is not read at runtime — it is kept as a human-readable
 * reference of the edge cases covered.
 *
 * Patterns tested inline:
 *   1. Missing parameter type annotation value: `a:`
 *   2. Missing variable initializer:     `const x = ;`
 *   3. Missing operand:                  `return x + ;`
 */
export function malformedFixture(): void {
  // Tests use inline strings equivalent to:
  //   export function broken(a:, b: number) { const x = ; return x + ; }
}
