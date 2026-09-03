// Builds an iCalendar invite for a quote-callback slot so it lands on Eric's
// calendar straight from the email. Slots come from the quote form as
// "Thu, Aug 20 · Morning" / "· Afternoon" (Morning = 8a–12p, Afternoon = 1p–5p,
// America/Chicago).

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

// RFC 5545 text escaping.
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

function icsLocal(y: number, mo: number, d: number, h: number): string {
  return `${y}${two(mo + 1)}${two(d)}T${two(h)}0000`;
}

// Standard VTIMEZONE for America/Chicago (CST/CDT).
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Chicago",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export function buildCallbackIcs(input: {
  requestId: string;
  slot: string;
  name: string;
  phone: string;
  jobType: string;
  desc: string;
  attendeeEmail: string;
}): { filename: string; contentBase64: string } | null {
  // "Thu, Aug 20 · Morning" → month name, day number, window.
  const m = input.slot.match(
    /([A-Za-z]{3})\s+(\d{1,2})\s*·\s*(Morning|Afternoon)/,
  );
  if (!m) return null;
  const month = MONTHS[m[1] as keyof typeof MONTHS];
  const day = Number(m[2]);
  if (month === undefined || !day || day > 31) return null;
  const [startH, endH] = m[3] === "Morning" ? [8, 12] : [13, 17];

  // Slots are always within the next week or so; pick the year that puts the
  // date in the future (handles late-December submissions for January slots).
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getTime() < now.getTime() - 45 * 24 * 3600 * 1000) year += 1;

  const stamp =
    `${now.getUTCFullYear()}${two(now.getUTCMonth() + 1)}${two(now.getUTCDate())}` +
    `T${two(now.getUTCHours())}${two(now.getUTCMinutes())}${two(now.getUTCSeconds())}Z`;

  const summary = `Quote callback — ${input.name} (${input.requestId})`;
  const description =
    `Call ${input.name} at ${input.phone}.\n` +
    `Job: ${input.jobType}\n` +
    `${input.desc}\n` +
    `Reference ${input.requestId} · from tidwellwelding.com`;

  const ics = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Tidwell Specialty Welding//Quote Callback//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${input.requestId}@tidwellwelding.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Chicago:${icsLocal(year, month, day, startH)}`,
    `DTEND;TZID=America/Chicago:${icsLocal(year, month, day, endH)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc("Phone: " + input.phone)}`,
    "ORGANIZER;CN=TSWS Website:mailto:quotes@tidwellwelding.com",
    `ATTENDEE;CN=Eric Tidwell;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // btoa handles latin1 only; route through UTF-8 percent-encoding first.
  const contentBase64 = btoa(unescape(encodeURIComponent(ics)));
  return { filename: `callback-${input.requestId}.ics`, contentBase64 };
}
