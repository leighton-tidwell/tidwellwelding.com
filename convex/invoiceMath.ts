/**
 * Invoice arithmetic. Pure functions, no Convex imports, so the browser and the
 * server run the identical code and can never disagree about a total.
 *
 * Money is integer cents everywhere. Floats are used only for the quantity
 * (part-hours are real) and are rounded back to cents at every boundary.
 */

export type LineUnit = "hr" | "ea" | "ft" | "lb" | "lot";

export type InvoiceLine = {
  qty: number;
  unit: LineUnit;
  description: string;
  rateCents: number;
  taxable: boolean;
};

export type InvoiceTotalsInput = {
  lines: InvoiceLine[];
  discountCents: number;
  taxRateBasisPoints: number;
  paymentsCents: number;
};

export type InvoiceTotals = {
  lineAmountsCents: number[];
  subtotalCents: number;
  /** Taxable work after its proportional share of the discount. */
  taxableSubtotalCents: number;
  discountCents: number;
  taxCents: number;
  /** Subtotal minus discount plus tax, before payments. */
  totalCents: number;
  /** What is still owed. Negative means the customer is in credit. */
  balanceCents: number;
};

/** Half-up rounding. Math.round() alone rounds -0.5 toward zero, which would
 * make a credit line disagree with its positive twin by a cent. */
function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

function assertWholeCents(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be whole cents, got ${value}`);
  }
}

export function lineAmountCents(line: InvoiceLine): number {
  if (!Number.isFinite(line.qty) || line.qty < 0) {
    throw new Error(`Line quantity must be zero or more, got ${line.qty}`);
  }
  assertWholeCents(line.rateCents, "Line rate");
  return roundHalfUp(line.qty * line.rateCents);
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const { lines, discountCents, taxRateBasisPoints, paymentsCents } = input;

  assertWholeCents(discountCents, "Discount");
  assertWholeCents(paymentsCents, "Payments");
  if (!Number.isFinite(taxRateBasisPoints) || taxRateBasisPoints < 0) {
    throw new Error(`Tax rate must be zero or more, got ${taxRateBasisPoints}`);
  }

  const lineAmountsCents = lines.map(lineAmountCents);
  const subtotalCents = lineAmountsCents.reduce((sum, cents) => sum + cents, 0);

  const rawTaxableCents = lines.reduce(
    (sum, line, i) => (line.taxable ? sum + lineAmountsCents[i] : sum),
    0,
  );

  // A discount is a reduction of the whole job, so it comes off taxable and
  // exempt work in proportion. Charging tax on the full taxable subtotal after
  // a discount would overstate the tax owed.
  const clampedDiscount = Math.min(Math.max(discountCents, 0), subtotalCents);
  const taxableShare =
    subtotalCents === 0 ? 0 : rawTaxableCents / subtotalCents;
  const discountOnTaxable = roundHalfUp(clampedDiscount * taxableShare);
  const taxableSubtotalCents = Math.max(rawTaxableCents - discountOnTaxable, 0);

  const taxCents = roundHalfUp(
    (taxableSubtotalCents * taxRateBasisPoints) / 10000,
  );
  const totalCents = subtotalCents - clampedDiscount + taxCents;
  const balanceCents = totalCents - paymentsCents;

  return {
    lineAmountsCents,
    subtotalCents,
    taxableSubtotalCents,
    discountCents: clampedDiscount,
    taxCents,
    totalCents,
    balanceCents,
  };
}

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Cents to "$9,518.08". Credits render as "-$50.00", not "($50.00)". */
export function formatMoney(cents: number): string {
  const formatted = CURRENCY.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${formatted}` : formatted;
}

/** Units that describe a measure get printed; a plain per-item price does not,
 * matching the invoice Eric already sends. */
const PRINTED_UNITS: ReadonlySet<LineUnit> = new Set<LineUnit>([
  "hr",
  "ft",
  "lb",
]);

export function formatRate(rateCents: number, unit: LineUnit): string {
  const money = formatMoney(rateCents);
  return PRINTED_UNITS.has(unit) ? `${money}/${unit}` : money;
}

/** Parse what someone types on a phone ("$1,124.60", " 44.08 ") into cents.
 * Returns null on junk so the caller can show a field error. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  if (cleaned === "." || cleaned === "-") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return roundHalfUp(value * 100);
}
