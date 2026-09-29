// The package's own ESLint config reports every decimal misuse in the deliberate fixture.
import { resolve } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const packageDir = resolve(import.meta.dirname, "..");

describe("decimal-safety lint rules", () => {
  it("report the deliberate misuse fixture", async () => {
    const eslint = new ESLint({ cwd: packageDir, ignore: false });
    const [result] = await eslint.lintFiles(["test/fixtures/decimal-misuse.ts"]);
    const ruleIds = (result?.messages ?? []).map((message) => message.ruleId);
    expect(ruleIds.filter((id) => id === "no-restricted-globals")).toHaveLength(1);
    // Number(...), parseFloat(...), Number.parseFloat(...) and unary +.
    expect(ruleIds.filter((id) => id === "no-restricted-syntax")).toHaveLength(4);
    // `+amount` and `amount + fee` on a DecimalString.
    expect(ruleIds.filter((id) => id === "carf-xml/no-decimal-arithmetic")).toHaveLength(2);
  });
});
