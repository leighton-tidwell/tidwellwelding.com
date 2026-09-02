import type { Estimate } from "./estimate";

/** HTML-escape user-supplied text before it goes into an email body. */
export function esc(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Strip control characters and newlines so user text is safe in a subject. */
export function headerSafe(input: string, max = 80): string {
  return input
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);
}

export function isEmail(input: string): boolean {
  return input.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input);
}

export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
}

export function formatPhone(phone: string): string {
  const d = phoneDigits(phone);
  if (d.length !== 10) return phone;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export type QuotePayload = {
  requestId: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  job: {
    type: string;
    material?: string;
    desc: string;
    dims?: string;
    timeline?: string;
    location?: string;
    compQuote?: string;
    photoNames?: string[];
  };
  estimate?: Estimate;
  slot: string;
};

const DISCLAIMER =
  "An AI drafted these numbers from your description. They are not the final quote and can change once Eric sees the job. He confirms every number before work starts.";

type Field = { label: string; value: string };

function contactFields(q: QuotePayload): Field[] {
  const out: Field[] = [{ label: "Name", value: q.name }];
  if (q.company) out.push({ label: "Company", value: q.company });
  out.push({ label: "Phone", value: formatPhone(q.phone) });
  if (q.email) out.push({ label: "Email", value: q.email });
  return out;
}

function jobFields(q: QuotePayload): Field[] {
  const j = q.job;
  const out: Field[] = [{ label: "Job type", value: j.type }];
  if (j.material) out.push({ label: "Material", value: j.material });
  out.push({ label: "Description", value: j.desc });
  if (j.dims) out.push({ label: "Dimensions", value: j.dims });
  if (j.timeline) out.push({ label: "Timeline", value: j.timeline });
  if (j.location) out.push({ label: "Location", value: j.location });
  if (j.compQuote)
    out.push({ label: "Quote they got", value: "$" + j.compQuote });
  if (j.photoNames?.length) {
    out.push({
      label: "Photos named",
      value: j.photoNames.join(", ") + " (names only, files not uploaded)",
    });
  }
  out.push({ label: "Callback slot", value: q.slot });
  return out;
}

function fieldsHtml(fields: Field[]): string {
  return (
    `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">` +
    fields
      .map(
        (f) =>
          `<tr>` +
          `<td style="padding: 6px 12px 6px 0; font-size: 13px; color: #555555; white-space: nowrap; vertical-align: top;">${esc(f.label)}</td>` +
          `<td style="padding: 6px 0; font-size: 14px; color: #000000; vertical-align: top;">${esc(f.value)}</td>` +
          `</tr>`,
      )
      .join("") +
    `</table>`
  );
}

function fieldsText(fields: Field[]): string {
  // Collapse newlines inside user values so a multi-line description cannot
  // spoof extra "Field: value" lines in the plain-text part.
  return fields
    .map((f) => `${f.label}: ${f.value.replace(/\s*\n\s*/g, " / ")}`)
    .join("\n");
}

function estimateHtml(est: Estimate, showDollars = true): string {
  const rows = est.line_items
    .map(
      (li) =>
        `<tr>` +
        `<td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #000000;">${esc(li.task)}</td>` +
        `<td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #000000; text-align: right;">${li.crew}</td>` +
        `<td style="padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 14px; color: #000000; text-align: right;">${li.hours}</td>` +
        `</tr>`,
    )
    .join("");
  const questions = est.questions.length
    ? `<p style="font-size: 13px; color: #555555; margin: 10px 0 0;">Eric will ask about: ${esc(est.questions.join("; "))}</p>`
    : "";
  return (
    `<h3 style="font-size: 15px; color: #000000; margin: 0 0 4px;">${esc(est.title)}</h3>` +
    `<p style="font-size: 14px; color: #000000; margin: 0 0 10px;">${esc(est.summary)}</p>` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #e5e5e5;">` +
    `<tr>` +
    `<th style="padding: 6px 8px; border-bottom: 2px solid #c90314; font-size: 12px; color: #555555; text-align: left;">Task</th>` +
    `<th style="padding: 6px 8px; border-bottom: 2px solid #c90314; font-size: 12px; color: #555555; text-align: right;">Crew</th>` +
    `<th style="padding: 6px 8px; border-bottom: 2px solid #c90314; font-size: 12px; color: #555555; text-align: right;">Hours</th>` +
    `</tr>` +
    rows +
    `<tr>` +
    `<td style="padding: 8px; font-size: 13px; color: #555555;">Total man-hours ${est.hours_low}–${est.hours_high}</td>` +
    (showDollars
      ? `<td colspan="2" style="padding: 8px; font-size: 16px; color: #c90314; font-weight: bold; text-align: right;">${money(est.dollars_low)} – ${money(est.dollars_high)}</td>`
      : `<td colspan="2" style="padding: 8px; font-size: 13px; color: #555555; text-align: right;">Eric sets the number on the call.</td>`) +
    `</tr>` +
    `</table>` +
    questions
  );
}

function estimateText(est: Estimate, showDollars = true): string {
  const rows = est.line_items
    .map((li) => `- ${li.task} | crew ${li.crew} | ${li.hours} h`)
    .join("\n");
  const questions = est.questions.length
    ? `\nEric will ask about: ${est.questions.join("; ")}`
    : "";
  const totals = showDollars
    ? `Total man-hours ${est.hours_low}-${est.hours_high} | ${money(est.dollars_low)} - ${money(est.dollars_high)}`
    : `Total man-hours ${est.hours_low}-${est.hours_high} | Eric sets the number on the call.`;
  return `${est.title}\n${est.summary}\n${rows}\n` + totals + questions;
}

const sectionLabel = (label: string) =>
  `<p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #c90314; margin: 22px 0 6px; font-weight: bold;">${label}</p>`;

function wrap(inner: string): string {
  return (
    `<div style="background: #ffffff; color: #000000; padding: 24px 16px;">` +
    `<div style="max-width: 620px; margin: 0 auto; font-family: Arial, Helvetica, sans-serif;">` +
    `<img src="https://tidwellwelding.com/logo-badge.png" alt="Tidwell Specialty Welding" height="46" style="display: block; height: 46px; width: auto; margin: 0 0 14px;" />` +
    `<div style="border-top: 4px solid #c90314; padding-top: 18px;">` +
    inner +
    `</div></div></div>`
  );
}

export function buildOwnerEmail(q: QuotePayload): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Quote request ${q.requestId} — ${headerSafe(q.job.type, 40)} — ${headerSafe(q.name, 40)}`;
  const digits = phoneDigits(q.phone);
  const telHtml =
    digits.length === 10
      ? `<p style="margin: 10px 0 0;"><a href="tel:+1${digits}" style="color: #c90314; font-size: 16px; font-weight: bold; text-decoration: none;">Call ${esc(q.name)}: ${esc(formatPhone(q.phone))}</a></p>`
      : "";
  const html = wrap(
    `<h2 style="font-size: 20px; margin: 0; color: #000000;">Quote request ${esc(q.requestId)}</h2>` +
      `<p style="font-size: 14px; margin: 6px 0 0; color: #000000;">Callback slot: <strong>${esc(q.slot)}</strong></p>` +
      telHtml +
      sectionLabel("Contact") +
      fieldsHtml(contactFields(q)) +
      sectionLabel("The job") +
      fieldsHtml(jobFields(q)) +
      (q.estimate
        ? sectionLabel("AI draft estimate") +
          estimateHtml(q.estimate) +
          `<p style="font-size: 12px; color: #555555; margin: 8px 0 0;">AI draft, confidence ${esc((q.estimate.confidence ?? "medium").toUpperCase())}.${q.estimate.confidence === "low" ? " The customer saw hours only, no dollars." : ""} Confirm every number before quoting.</p>`
        : ""),
  );
  const text =
    `Quote request ${q.requestId}\n` +
    `Callback slot: ${q.slot}\n\n` +
    `CONTACT\n${fieldsText(contactFields(q))}\n\n` +
    `THE JOB\n${fieldsText(jobFields(q))}\n` +
    (q.estimate
      ? `\nAI DRAFT ESTIMATE\n${estimateText(q.estimate)}\nAI draft, confidence ${(q.estimate.confidence ?? "medium").toUpperCase()}.${q.estimate.confidence === "low" ? " The customer saw hours only, no dollars." : ""} Confirm every number before quoting.\n`
      : "");
  return { subject, html, text };
}

export function buildCustomerEmail(input: QuotePayload): {
  subject: string;
  html: string;
  text: string;
} {
  // The customer copy goes to a submitter-supplied address. Truncate the
  // description so the form cannot relay long arbitrary text to third parties.
  const shortDesc =
    input.job.desc.length > 300
      ? input.job.desc.slice(0, 300).trimEnd() + "…"
      : input.job.desc;
  const q: QuotePayload = {
    ...input,
    job: { ...input.job, desc: shortDesc },
  };
  const subject = `Request ${q.requestId} received — Tidwell Specialty Welding`;
  const html = wrap(
    `<h2 style="font-size: 20px; margin: 0; color: #000000;">Request sent.</h2>` +
      `<p style="font-size: 15px; margin: 8px 0 0; color: #000000;">Eric will call you back at your slot: <strong>${esc(q.slot)}</strong>. Your reference is <strong style="color: #c90314;">${esc(q.requestId)}</strong>.</p>` +
      sectionLabel("What you sent") +
      fieldsHtml([...contactFields(q), ...jobFields(q)]) +
      (q.estimate
        ? sectionLabel("The AI draft you saw") +
          estimateHtml(q.estimate, q.estimate.confidence !== "low") +
          (q.estimate.confidence === "low"
            ? `<p style="font-size: 13px; color: #000000; margin: 10px 0 0;">We estimate ${q.estimate.hours_low}–${q.estimate.hours_high} hours of work. We need more details before we put a number on it. Eric will firm it up on the call.</p>`
            : "")
        : "") +
      `<p style="font-size: 13px; color: #555555; border: 1px solid #e5e5e5; padding: 10px 12px; margin: 18px 0 0;">${DISCLAIMER}</p>` +
      `<p style="font-size: 13px; color: #000000; margin: 22px 0 0; border-top: 1px solid #e5e5e5; padding-top: 12px;">(817) 894-6357 &middot; eric@tidwellwelding.com</p>`,
  );
  const text =
    `Request sent. Eric will call you back at your slot: ${q.slot}.\n` +
    `Your reference is ${q.requestId}.\n\n` +
    `WHAT YOU SENT\n${fieldsText([...contactFields(q), ...jobFields(q)])}\n` +
    (q.estimate
      ? `\nTHE AI DRAFT YOU SAW\n${estimateText(q.estimate, q.estimate.confidence !== "low")}\n` +
        (q.estimate.confidence === "low"
          ? `We estimate ${q.estimate.hours_low}-${q.estimate.hours_high} hours of work. We need more details before we put a number on it. Eric will firm it up on the call.\n`
          : "")
      : "") +
    `\n${DISCLAIMER}\n\n(817) 894-6357 · eric@tidwellwelding.com`;
  return { subject, html, text };
}
