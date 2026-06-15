import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modulesnode_modules/**",
      "**/.next.next/**",
      "**/distdist/**",
      "**/coveragecoverage/**",
      "Implementacion/design
*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["tests/e2e/fixtures*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["tests/load*.js"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
      },
    },
  },
);
