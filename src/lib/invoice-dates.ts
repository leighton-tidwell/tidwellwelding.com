/**
 * Date-input helpers for the invoice editor.
 *
 * An `<input type="date">` speaks "YYYY-MM-DD" with no timezone attached.
 * Passing that string to `new Date(...)` parses it as midnight UTC, which is
 * the previous evening in Central time — so an invoice dated the 31st would
 * print the 30th. Both directions go through the shop's timezone instead.
 */

const SHOP_TIME_ZONE = "America/Chicago";

const DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Timestamp -> "YYYY-MM-DD" as read on a calendar in Granbury. */
export function toDateInputValue(ms: number): string {
  // en-CA already formats as YYYY-MM-DD.
  return DATE_PARTS.format(new Date(ms));
}

/**
 * "YYYY-MM-DD" -> a timestamp at midday shop time. Midday keeps the calendar
 * day stable across DST changes and offset differences, so a round trip cannot
 * drift onto the neighbouring day.
 */
export function fromDateInputValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const noon = Date.UTC(Number(year), Number(month) - 1, Number(day), 12);
  if (Number.isNaN(noon)) return null;

  // Anchor to midday in the shop's zone: start from midday UTC, then correct
  // by the zone's offset on that date so the local calendar day matches.
  const offsetMinutes = zoneOffsetMinutes(noon);
  return noon + offsetMinutes * 60_000;
}

/** Minutes to add to a UTC instant to reach shop-local wall time. */
function zoneOffsetMinutes(ms: number): number {
  const local = new Date(
    new Date(ms).toLocaleString("en-US", { timeZone: SHOP_TIME_ZONE }),
  );
  const utc = new Date(
    new Date(ms).toLocaleString("en-US", { timeZone: "UTC" }),
  );
  return Math.round((utc.getTime() - local.getTime()) / 60_000);
}
