// ESLint rule: forbids arithmetic on values typed as DecimalString. DecimalString (src/decimal.ts)
// is a branded string: TypeScript rejects - * / % ** on strings, but `+` concatenates and unary
// +/- convert to a number, and typescript-eslint's restrict-plus-operands does not see through
// the brand. This rule does. Amounts and quantities must stay exact decimal strings.
import { ESLintUtils } from "@typescript-eslint/utils";

const BRAND_PROPERTY = "__brand";
const BRAND_VALUE = "DecimalString";
const ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "/", "%", "**"]);
const ARITHMETIC_ASSIGNMENTS = new Set(["+=", "-=", "*=", "/=", "%=", "**="]);

/**
 * @param {import("typescript").TypeChecker} checker
 * @param {import("typescript").Type} type
 */
function isDecimalString(checker, type) {
  const types = type.isUnionOrIntersection() ? [type, ...type.types] : [type];
  return types.some((candidate) => {
    const brand = checker.getPropertyOfType(candidate, BRAND_PROPERTY);
    if (brand === undefined) {
      return false;
    }
    const brandType = checker.getTypeOfSymbol(brand);
    return brandType.isStringLiteral() && brandType.value === BRAND_VALUE;
  });
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/zettacore-labs/carf-xml/blob/main/README.md#${name}`,
);

export const noDecimalArithmetic = createRule({
  name: "no-decimal-arithmetic",
  meta: {
    type: "problem",
    docs: { description: "Disallow arithmetic operators on DecimalString values." },
    messages: {
      noArithmetic:
        "Arithmetic on a DecimalString is not allowed: amounts and quantities stay exact decimal strings.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const isDecimal = (node) => isDecimalString(checker, services.getTypeAtLocation(node));

    return {
      BinaryExpression(node) {
        if (
          ARITHMETIC_OPERATORS.has(node.operator) &&
          (isDecimal(node.left) || isDecimal(node.right))
        ) {
          context.report({ node, messageId: "noArithmetic" });
        }
      },
      AssignmentExpression(node) {
        if (
          ARITHMETIC_ASSIGNMENTS.has(node.operator) &&
          (isDecimal(node.left) || isDecimal(node.right))
        ) {
          context.report({ node, messageId: "noArithmetic" });
        }
      },
      UnaryExpression(node) {
        if ((node.operator === "+" || node.operator === "-") && isDecimal(node.argument)) {
          context.report({ node, messageId: "noArithmetic" });
        }
      },
      UpdateExpression(node) {
        if (isDecimal(node.argument)) {
          context.report({ node, messageId: "noArithmetic" });
        }
      },
    };
  },
});

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: "eslint-plugin-carf-xml" },
  rules: { "no-decimal-arithmetic": noDecimalArithmetic },
};

export default plugin;
