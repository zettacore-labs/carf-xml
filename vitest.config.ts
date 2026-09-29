import { defineConfig } from "vitest/config";

// Tests that need the official OECD XSDs (and xmllint) run only when CARF_SCHEMA_DIR is set;
// a standalone copy of this package has no XSDs and reports them as skipped. With the XSDs
// present, coverage must reach 90%.
const withSchemas = (process.env.CARF_SCHEMA_DIR ?? "") !== "";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/generated/**"],
      reporter: ["text-summary", "text"],
      ...(withSchemas
        ? { thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 } }
        : {}),
    },
  },
});
