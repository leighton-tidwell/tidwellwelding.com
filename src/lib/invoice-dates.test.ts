import { describe, expect, it } from "vitest";
import { fromDateInputValue, toDateInputValue } from "./invoice-dates";

/**
 * A date input speaks "YYYY-MM-DD" with no timezone. Parsing that string with
 * `new Date(...)` treats it as UTC, which lands on the previous day for anyone
 * in Central time — an invoice dated the 31st would print the 30th.
 */
describe("invoice date fields", () => {
  it("shows the shop's local calendar day, not the UTC one", () => {
    // 2026-08-31 01:00 UTC is still 2026-08-30 in Granbury.
    const lateNightUtc = Date.UTC(2026, 7, 31, 1, 0);
    expect(toDateInputValue(lateNightUtc)).toBe("2026-08-30");
  });

  it("keeps a mid-afternoon timestamp on its own day", () => {
    expect(toDateInputValue(Date.UTC(2026, 7, 31, 18, 0))).toBe("2026-08-31");
  });

  it("round-trips a date through the input and back", () => {
    const value = "2026-09-30";
    const ms = fromDateInputValue(value);
    expect(ms).not.toBeNull();
    expect(toDateInputValue(ms as number)).toBe(value);
  });

  it("treats the typed day as a local day, not a UTC instant", () => {
    const ms = fromDateInputValue("2026-08-31") as number;
    // Midday local keeps the date stable regardless of DST or offset.
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
    expect(local).toBe("08/31/2026");
  });

  it("rejects an empty or malformed value", () => {
    expect(fromDateInputValue("")).toBeNull();
    expect(fromDateInputValue("not-a-date")).toBeNull();
  });
});
