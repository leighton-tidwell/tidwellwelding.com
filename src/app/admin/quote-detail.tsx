"use client";

import { Badge, Button, Icon } from "@/components/ds";
import { formatMoney } from "@/lib/invoice-format";
import DownloadPdfButton from "./download-pdf-button";

/** Mirrors what convex/adminQuotes.get returns. Kept as an explicit prop type
 * rather than inferred from the API so this stays a plain presentational
 * component: it never queries, which is what makes it testable with fixtures. */
export type QuoteFile = {
  name: string;
  contentType: string;
  size: number;
  competitor: boolean;
  url: string | null;
};

export type QuoteEstimate = {
  title: string;
  summary: string;
  lineItems: { task: string; crew: number; hours: number }[];
  hoursLow: number;
  hoursHigh: number;
  dollarsLow: number;
  dollarsHigh: number;
  confidence: "high" | "medium" | "low";
  questions: string[];
};

export type QuoteDetailData = {
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
    thickness?: string;
    quantity?: string;
    timeline?: string;
    location?: string;
    compQuote?: string;
    photoNames?: string[];
  };
  files: QuoteFile[];
  estimate: QuoteEstimate | null;
  slot: string;
  status: string;
  createdAt: number;
};

/** Human size for the attachment rows. Bytes are what storage reports. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-field">
      <span className="admin-field__label">{label}</span>
      <span className="admin-field__value">{value}</span>
    </div>
  );
}

/** Only the details the customer actually filled in, in the order the form
 * asks for them. Blank optional answers are left out rather than printed as
 * empty rows — a short request should read short, not full of holes. */
function jobFields(job: QuoteDetailData["job"]): [string, string][] {
  const rows: [string, string][] = [["Job type", job.type]];
  const optional: [string, string | undefined][] = [
    ["Material", job.material],
    ["Dimensions", job.dims],
    ["Thickness", job.thickness],
    ["Quantity", job.quantity],
    ["Timeline", job.timeline],
    ["Location", job.location],
    ["Competitor quote", job.compQuote],
  ];
  for (const [label, value] of optional) {
    if (value !== undefined && value.trim() !== "") rows.push([label, value]);
  }
  return rows;
}

export default function QuoteDetail({
  quote,
  onBack,
}: {
  quote: QuoteDetailData;
  onBack: () => void;
}) {
  const contact = [quote.company, quote.phone, quote.email]
    .filter(Boolean)
    .join(" · ");
  // Names the browser listed at submit time that have no stored blob. Quotes
  // taken before #17 are all of these; a newer row normally has none.
  const storedNames = new Set(quote.files.map((file) => file.name));
  const unstoredNames = (quote.job.photoNames ?? []).filter(
    (name) => !storedNames.has(name),
  );

  return (
    <>
      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Button variant="quiet" size="sm" onClick={onBack}>
          <Icon name="arrow-left" /> All quotes
        </Button>
      </div>

      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">{quote.job.type}</p>
          <h1 className="admin-title">{quote.requestId}</h1>
        </div>
        <span className={`admin-status admin-status--${quote.status}`}>
          {quote.status}
        </span>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Who asked</h2>
        <div className="admin-fields">
          <Field label="Name" value={quote.name} />
          {contact ? <Field label="Contact" value={contact} /> : null}
          <Field label="Callback slot" value={quote.slot} />
          <Field
            label="Came in"
            value={new Date(quote.createdAt).toLocaleString("en-US")}
          />
        </div>
        <div className="admin-actions">
          {/* Digits only: a tel: href with the display formatting in it is
              not reliably dialable. */}
          <Button
            variant="secondary"
            size="sm"
            href={`tel:${quote.phone.replace(/\D/g, "")}`}
          >
            <Icon name="phone" /> Call {quote.phone}
          </Button>
          {quote.email ? (
            <Button
              variant="secondary"
              size="sm"
              href={`mailto:${quote.email}?subject=${encodeURIComponent(
                `Your quote request ${quote.requestId}`,
              )}`}
            >
              <Icon name="mail" /> Email back
            </Button>
          ) : null}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">The job</h2>
        <p className="admin-quote-desc">{quote.job.desc}</p>
        <div className="admin-fields">
          {jobFields(quote.job).map(([label, value]) => (
            <Field key={label} label={label} value={value} />
          ))}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Draft estimate</h2>
        {quote.estimate === null ? (
          <p className="admin-note">
            No AI draft was saved with this request. Price it from the job
            details above.
          </p>
        ) : (
          <>
            <div className="admin-head" style={{ marginBottom: 8 }}>
              <div>
                <p className="admin-eyebrow">{quote.estimate.title}</p>
                <p className="admin-quote-range">
                  {formatMoney(quote.estimate.dollarsLow * 100)} –{" "}
                  {formatMoney(quote.estimate.dollarsHigh * 100)}
                </p>
              </div>
              <Badge>{quote.estimate.confidence} confidence</Badge>
            </div>
            <p className="admin-note">
              {quote.estimate.hoursLow}–{quote.estimate.hoursHigh} hours ·{" "}
              {quote.estimate.summary}
            </p>
            <ul className="admin-quote-lines">
              {quote.estimate.lineItems.map((line) => (
                <li key={line.task}>
                  <span>{line.task}</span>
                  <span className="admin-row__amount">
                    {line.hours} hr{line.crew > 1 ? ` × ${line.crew}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {quote.estimate.questions.length > 0 ? (
              <>
                <h3 className="admin-card__title">Worth asking</h3>
                <ul className="admin-quote-lines">
                  {quote.estimate.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Files</h2>
        {quote.files.length === 0 ? (
          <p className="admin-note">
            {unstoredNames.length > 0
              ? `This request listed ${unstoredNames.join(", ")}, but it came in before the site kept uploaded files. Ask for them again if you need them.`
              : "No photos or drawings came with this request."}
          </p>
        ) : (
          <div className="admin-files">
            {quote.files.map((file) => (
              <div className="admin-file" key={file.name}>
                <span className="admin-file__main">
                  <span className="admin-row__title">
                    <Icon name="paperclip" size={14} /> {file.name}
                    {file.competitor ? (
                      <>
                        {" "}
                        <Badge>competitor quote</Badge>
                      </>
                    ) : null}
                  </span>
                  <span className="admin-row__meta">
                    {file.contentType || "unknown type"} ·{" "}
                    {formatFileSize(file.size)}
                  </span>
                </span>
                {file.url === null ? (
                  <p className="admin-note">
                    That file is no longer in storage.
                  </p>
                ) : (
                  // Reuses the invoice download button: same cross-origin blob
                  // dance, so the file saves under its real name.
                  <DownloadPdfButton
                    generate={fileUrlGetter(file.url)}
                    filename={file.name}
                    label="Download"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {quote.files.length > 0 && unstoredNames.length > 0 ? (
          <p className="admin-note">
            Also listed, but not stored: {unstoredNames.join(", ")}.
          </p>
        ) : null}
      </div>
    </>
  );
}

/** A stable resolver per URL; the download button expects to call for the URL
 * rather than be handed one, because an invoice has to be built first. */
function fileUrlGetter(url: string): () => Promise<string> {
  return () => Promise.resolve(url);
}
