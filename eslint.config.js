// ESLint config for this package on its own (it is also published as a standalone repository).
// Strict type-checked TypeScript rules plus the decimal-safety rules: amounts and quantities are
// exact decimal strings, never JavaScript numbers.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

import decimalPlugin from "./eslint-rules/no-decimal-arithmetic.js";

const DECIMAL_MESSAGE =
  "Amounts and quantities are never JavaScript numbers: keep them as DecimalString (src/decimal.ts).";

export default defineConfig(
  // test/fixtures/decimal-misuse.ts breaks the rules on purpose (test/eslint-decimal.test.ts).
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "test/fixtures/decimal-misuse.ts"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "test/fixtures/decimal-misuse.ts"],
    plugins: { "carf-xml": decimalPlugin },
    rules: {
      "no-restricted-globals": ["error", { name: "parseFloat", message: DECIMAL_MESSAGE }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='Number']",
          message: DECIMAL_MESSAGE,
        },
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='parseFloat']",
          message: DECIMAL_MESSAGE,
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='Number'][callee.property.name='parseFloat']",
          message: DECIMAL_MESSAGE,
        },
        { selector: "UnaryExpression[operator='+']", message: DECIMAL_MESSAGE },
      ],
      "carf-xml/no-decimal-arithmetic": "error",
      "@typescript-eslint/restrict-plus-operands": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false,
          skipCompoundAssignments: false,
        },
      ],
    },
  },
);
