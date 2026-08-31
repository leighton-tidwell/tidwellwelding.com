/**
 * Client-side money and rate formatting for the admin console.
 *
 * These mirror the pure helpers in convex/invoiceMath.ts. The browser cannot
 * import from convex/ (it is bundled for the Convex runtime), so the small
 * formatting layer lives here and is covered by its own tests. All authoritative
 * arithmetic still happens on the server — nothing here decides what is owed.
 */

export type LineUnit = "hr" | "ea" | "ft" | "lb" | "lot";

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatMoney(cents: number): string {
  const formatted = CURRENCY.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${formatted}` : formatted;
}

const PRINTED_UNITS: ReadonlySet<LineUnit> = new Set<LineUnit>(["hr", "ft", "lb"]);

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
  return value < 0 ? -Math.round(-value * 100) : Math.round(value * 100);
}
