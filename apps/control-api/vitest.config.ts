import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src*.ts"],
      exclude: ["src*.test.ts", "src/**/*.spec.ts", "src/**/index.ts"],
      thresholds: {
        statements: 70,
        branches: 50,
        functions: 60,
        lines: 70,
      },
    },
  },
});
