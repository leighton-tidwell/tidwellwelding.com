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

/** The quote's two outward links, as the server reports them. Null means the
 * step has not happened — or that the linked row was deleted, which reads the
 * same way here: there is nothing to open. */
export type QuoteCustomerLink = { _id: string; name: string };
export type QuoteInvoiceLink = {
  _id: string;
  number: string;
  status: string;
};

/**
 * What the operator can do with a request, handed in rather than queried so
 * this stays a presentational component. Omit it and the card still shows what
 * the quote is linked to, just without the buttons.
 */
export type QuoteLinkActions = {
  onCreateCustomer: () => void;
  onCreateInvoice: () => void;
  onOpenCustomer: (id: string) => void;
  onOpenInvoice: (id: string) => void;
  /** A mutation is in flight; the buttons go quiet so it cannot double-fire. */
  busy?: boolean;
  error?: string;
  /** Someone with this quote's name is already in the customer book, so the
   * operator has to say whether it is the same person. */
  nameConflict?: { customerId: string; customerName: string } | null;
  onLinkExistingCustomer?: () => void;
  onCreateSeparateCustomer?: () => void;
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
  customer: QuoteCustomerLink | null;
  invoice: QuoteInvoiceLink | null;
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

/**
 * Where a request stops being an inbox item. Shows what the quote has already
 * been turned into, and offers the step that has not happened yet — a customer
 * first, because an invoice needs somebody to bill.
 */
function WorkCard({
  quote,
  actions,
}: {
  quote: QuoteDetailData;
  actions?: QuoteLinkActions;
}) {
  const conflict = actions?.nameConflict ?? null;
  const busy = actions?.busy === true;

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Turn this into work</h2>

      <div className="admin-fields">
        <div className="admin-field">
          <span className="admin-field__label">Customer</span>
          <span className="admin-field__value">
            {quote.customer === null ? (
              "Not saved yet"
            ) : actions === undefined ? (
              quote.customer.name
            ) : (
              <button
                type="button"
                className="admin-linkish"
                onClick={() =>
                  actions.onOpenCustomer(quote.customer?._id ?? "")
                }
              >
                {quote.customer.name}
              </button>
            )}
          </span>
        </div>
        <div className="admin-field">
          <span className="admin-field__label">Invoice</span>
          <span className="admin-field__value">
            {quote.invoice === null ? (
              "None raised yet"
            ) : actions === undefined ? (
              quote.invoice.number
            ) : (
              <button
                type="button"
                className="admin-linkish"
                onClick={() => actions.onOpenInvoice(quote.invoice?._id ?? "")}
              >
                {quote.invoice.number}
              </button>
            )}
          </span>
        </div>
      </div>

      {conflict !== null ? (
        <>
          <p className="admin-note">
            A customer called {conflict.customerName} is already saved. Same
            person, or a different one with the same name?
          </p>
          <div className="admin-actions">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => actions?.onLinkExistingCustomer?.()}
            >
              <Icon name="user" /> Same person — link them
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => actions?.onCreateSeparateCustomer?.()}
            >
              <Icon name="plus" /> Different — save a separate one
            </Button>
          </div>
        </>
      ) : actions !== undefined ? (
        <div className="admin-actions">
          {quote.customer === null ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={actions.onCreateCustomer}
            >
              <Icon name="user" /> Save as customer
            </Button>
          ) : null}
          {quote.invoice === null ? (
            <Button
              variant={quote.customer === null ? "secondary" : "primary"}
              size="sm"
              disabled={busy || quote.customer === null}
              onClick={actions.onCreateInvoice}
            >
              <Icon name="file-text" /> Create invoice
            </Button>
          ) : null}
        </div>
      ) : null}

      {quote.customer === null && conflict === null ? (
        <p className="admin-note">
          An invoice needs somebody to bill, so save the customer first. The
          estimate&rsquo;s tasks and hours come across as hourly lines.
        </p>
      ) : null}

      {actions?.error ? (
        <p className="admin-gate__error" role="alert">
          {actions.error}
        </p>
      ) : null}
    </div>
  );
}

export default function QuoteDetail({
  quote,
  onBack,
  actions,
}: {
  quote: QuoteDetailData;
  onBack: () => void;
  actions?: QuoteLinkActions;
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

      <WorkCard quote={quote} actions={actions} />

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
              : "No photos, video or drawings came with this request."}
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
