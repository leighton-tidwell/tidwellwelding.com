import { describe, expect, test } from "vitest";
import {
  formatMoney as clientFormatMoney,
  formatRate as clientFormatRate,
  parseMoneyToCents as clientParse,
} from "./invoice-format";
import {
  formatMoney as serverFormatMoney,
  formatRate as serverFormatRate,
  parseMoneyToCents as serverParse,
  type LineUnit,
} from "../../convex/invoiceMath";

/**
 * The browser cannot import from convex/, so the formatting helpers are
 * duplicated in src/lib/invoice-format.ts. Duplication drifts unless something
 * holds it still: these tests fail the moment the two copies disagree, which is
 * the only reason the duplication is acceptable.
 */
const MONEY_CASES = [0, 1, 50, 999, 1000, 4408, 262_50, 437_500, 951_808, -5000, -1];
const UNITS: LineUnit[] = ["hr", "ea", "ft", "lb", "lot"];
const PARSE_CASES = [
  "175",
  "175.00",
  "$1,124.60",
  "  44.08 ",
  "10.005",
  "0",
  "",
  "abc",
  "1.2.3",
  ".",
  "-",
];

describe("client and server formatters agree", () => {
  test("formatMoney matches for every representative amount", () => {
    for (const cents of MONEY_CASES) {
      expect(clientFormatMoney(cents), `cents=${cents}`).toBe(
        serverFormatMoney(cents),
      );
    }
  });

  test("formatRate matches for every unit", () => {
    for (const unit of UNITS) {
      for (const cents of [17500, 299900, 4408, 1250, 275]) {
        expect(clientFormatRate(cents, unit), `${cents}/${unit}`).toBe(
          serverFormatRate(cents, unit),
        );
      }
    }
  });

  test("parseMoneyToCents matches, including the junk cases", () => {
    for (const input of PARSE_CASES) {
      expect(clientParse(input), `input=${JSON.stringify(input)}`).toBe(
        serverParse(input),
      );
    }
  });
});
