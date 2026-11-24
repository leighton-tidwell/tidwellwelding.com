"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { Button, Icon, Input, Select } from "@/components/ds";
import { NAME } from "@/lib/business";
import { fromDateInputValue, toDateInputValue } from "@/lib/invoice-dates";
import { formatMoney, parseMoneyToCents } from "@/lib/invoice-format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { INVOICE_NOTES } from "../../../convex/noteLines";
import DownloadPdfButton from "./download-pdf-button";
import LineItemEditor, { type EditorLine, emptyLine } from "./line-item-editor";
import { type SectionId, visibleSections } from "./nav";
import NotesField from "./notes-field";
import { PackingSlipEditor, PackingSlipList } from "./packing-slips";
import QuoteDetail from "./quote-detail";
import {
  AdminShell,
  countOf,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusMark,
} from "./shell";
import { useAdminSession } from "./use-admin-session";
import "./tokens.css";
import "./admin.css";

type View =
  | { name: "invoices" }
  | { name: "quotes" }
  | { name: "quote"; id: Id<"quotes"> }
  | { name: "customers" }
  | { name: "customer"; id: Id<"customers"> }
  | { name: "invoice"; id: Id<"invoices"> }
  | { name: "slips" }
  | { name: "slip"; id: Id<"packingSlips"> };

export default function AdminConsole() {
  const { token, ready, signIn, signOut } = useAdminSession();

  if (!ready) return <div className="adm adm-blank" />;
  if (!token) return <LoginScreen onSignedIn={signIn} />;
  return <Console token={token} onSignOut={signOut} />;
}

/* ---------------------------------------------------------------- login --- */

function LoginScreen({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const login = useMutation(api.auth.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await login({ email: email.trim(), password });
      if (result.ok && result.token) {
        onSignedIn(result.token);
      } else {
        // The server's message is deliberately vague about which field was
        // wrong; the rate-limit case is the one place it says more.
        setError(result.error ?? "That email and password did not match.");
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm admin-gate">
      <form
        className="admin-gate__plate"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="admin-gate__ws">{NAME}</p>
        <h1 className="admin-gate__title">Shop admin</h1>
        <p className="admin-gate__sub">
          Sign in to quotes, invoices and slips.
        </p>

        <div className="admin-gate__fields">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <Button type="submit" block disabled={busy} ariaBusy={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </div>

        {error ? (
          <p className="admin-gate__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/* -------------------------------------------------------------- console --- */

/** Which nav section a screen belongs to, so detail screens keep their
 * section lit. */
const SECTION_OF: Record<View["name"], SectionId> = {
  invoices: "invoices",
  invoice: "invoices",
  quotes: "quotes",
  quote: "quotes",
  customers: "customers",
  customer: "customers",
  slips: "slips",
  slip: "slips",
};

/** Where each section's nav item lands. A section with no screen yet is never
 * visible (see nav.ts), so it needs no entry. */
const HOME_OF: Partial<Record<SectionId, View>> = {
  invoices: { name: "invoices" },
  quotes: { name: "quotes" },
  customers: { name: "customers" },
  slips: { name: "slips" },
};

function Console({
  token,
  onSignOut,
}: {
  token: string;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<View>({ name: "invoices" });
  const sections = useMemo(() => visibleSections(), []);

  return (
    <AdminShell
      workspace={NAME}
      sections={sections}
      current={SECTION_OF[view.name]}
      onNavigate={(id) => {
        const home = HOME_OF[id];
        if (home) setView(home);
      }}
      onSignOut={onSignOut}
      screenKey={"id" in view ? `${view.name}:${view.id}` : view.name}
    >
      {view.name === "invoices" && (
        <InvoiceList
          token={token}
          onOpen={(id) => setView({ name: "invoice", id })}
        />
      )}
      {view.name === "quotes" && (
        <QuoteList
          token={token}
          onOpen={(id) => setView({ name: "quote", id })}
        />
      )}
      {view.name === "quote" && (
        <QuoteInbox
          token={token}
          id={view.id}
          onBack={() => setView({ name: "quotes" })}
          onOpenCustomer={(id) => setView({ name: "customer", id })}
          onOpenInvoice={(id) => setView({ name: "invoice", id })}
        />
      )}
      {view.name === "customers" && (
        <CustomerList
          token={token}
          onOpen={(id) => setView({ name: "customer", id })}
        />
      )}
      {view.name === "customer" && (
        <CustomerDetail
          token={token}
          id={view.id}
          onBack={() => setView({ name: "customers" })}
          onOpenInvoice={(id) => setView({ name: "invoice", id })}
        />
      )}
      {view.name === "invoice" && (
        <InvoiceEditor
          token={token}
          id={view.id}
          onBack={() => setView({ name: "invoices" })}
          onOpenQuote={(id) => setView({ name: "quote", id })}
          onOpenSlip={(id) => setView({ name: "slip", id })}
        />
      )}
      {view.name === "slips" && (
        <PackingSlipList
          token={token}
          onOpen={(id) => setView({ name: "slip", id })}
        />
      )}
      {view.name === "slip" && (
        <PackingSlipEditor
          token={token}
          id={view.id}
          onBack={() => setView({ name: "slips" })}
          onOpenInvoice={(id) => setView({ name: "invoice", id })}
        />
      )}
    </AdminShell>
  );
}

/* ------------------------------------------------------------- invoices --- */

/** The line under the Invoices title. "Outstanding" is what has been sent
 * and not yet paid; drafts have not been billed and void ones never will be. */
function invoiceSummary(
  invoices: { status: string; totals: { balanceCents: number } }[] | undefined,
): string {
  if (invoices === undefined || invoices.length === 0)
    return "Every bill the shop sends.";
  const outstanding = invoices
    .filter((invoice) => invoice.status === "sent")
    .reduce((sum, invoice) => sum + invoice.totals.balanceCents, 0);
  const count = countOf(invoices.length, "invoice");
  return outstanding === 0
    ? `${count} · nothing outstanding`
    : `${count} · ${formatMoney(outstanding)} outstanding`;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
] as const;

function InvoiceList({
  token,
  onOpen,
}: {
  token: string;
  onOpen: (id: Id<"invoices">) => void;
}) {
  const [status, setStatus] = useState("");
  // Unfiltered: the counts on the chips have to reflect everything, not the
  // slice currently shown, or the filter would hide its own way back.
  const invoices = useQuery(api.invoices.list, { token });
  const customers = useQuery(api.customers.list, { token });
  const create = useMutation(api.invoices.create);
  const [customerId, setCustomerId] = useState("");

  const options = useMemo(
    () => (customers ?? []).map((c) => ({ value: c._id, label: c.name })),
    [customers],
  );

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const invoice of invoices ?? []) {
      tally[invoice.status] = (tally[invoice.status] ?? 0) + 1;
    }
    return tally;
  }, [invoices]);

  const shown = useMemo(
    () =>
      status === ""
        ? (invoices ?? [])
        : (invoices ?? []).filter((invoice) => invoice.status === status),
    [invoices, status],
  );

  return (
    <>
      <PageHeader title="Invoices" meta={invoiceSummary(invoices)} />

      <section className="admin-card" aria-labelledby="new-invoice">
        <h2 className="admin-card__title" id="new-invoice">
          Start a new invoice
        </h2>
        {options.length === 0 ? (
          <p className="admin-note">
            Add a customer first, then bill them here.
          </p>
        ) : (
          <div className="admin-start">
            <Select
              label="Customer"
              options={options}
              placeholder="Pick a customer"
              value={customerId}
              onChange={setCustomerId}
            />
            <Button
              disabled={!customerId}
              onClick={async () => {
                const id = await create({
                  token,
                  customerId: customerId as Id<"customers">,
                });
                onOpen(id);
              }}
            >
              <Icon name="plus" /> Create invoice
            </Button>
          </div>
        )}
      </section>

      {invoices === undefined ? (
        <LoadingState />
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices yet">
          Pick a customer above to start the first one.
        </EmptyState>
      ) : (
        <>
          {/* biome-ignore lint/a11y/useSemanticElements: role=group is valid; <fieldset> brings UA layout quirks to the flex row. */}
          <div
            className="admin-filters"
            role="group"
            aria-label="Filter invoices by status"
          >
            {STATUS_FILTERS.map((filter) => {
              const count =
                filter.value === ""
                  ? invoices.length
                  : (counts[filter.value] ?? 0);
              const active = status === filter.value;
              return (
                <button
                  key={filter.value || "all"}
                  type="button"
                  className={
                    active ? "admin-filter admin-filter--on" : "admin-filter"
                  }
                  aria-pressed={active}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                  <span className="admin-filter__count">{count}</span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState title="Nothing with that status">
              <button
                type="button"
                className="admin-linkish"
                onClick={() => setStatus("")}
              >
                Show all invoices
              </button>
            </EmptyState>
          ) : (
            <div className="admin-list">
              {shown.map((invoice) => (
                <button
                  key={invoice._id}
                  type="button"
                  className={
                    invoice.status === "void"
                      ? "admin-row admin-row--void"
                      : "admin-row"
                  }
                  onClick={() => onOpen(invoice._id)}
                >
                  <span className="admin-row__main">
                    <span className="admin-row__title">{invoice.number}</span>
                    <span className="admin-row__meta">
                      {invoice.customerName} · {invoice.lineItems.length} line
                      {invoice.lineItems.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="admin-row__amount">
                    {formatMoney(invoice.totals.balanceCents)}
                  </span>
                  <StatusMark status={invoice.status} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- quotes --- */

function QuoteList({
  token,
  onOpen,
}: {
  token: string;
  onOpen: (id: Id<"quotes">) => void;
}) {
  const quotes = useQuery(api.adminQuotes.list, { token });
  const [status, setStatus] = useState("");

  // Statuses on quote rows are free-form strings set by the submit path, not a
  // fixed union like invoices', so the chips are built from what is actually
  // in the inbox instead of a hard-coded list that could go stale.
  const statuses = useMemo(() => {
    const tally = new Map<string, number>();
    for (const quote of quotes ?? []) {
      tally.set(quote.status, (tally.get(quote.status) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [quotes]);

  const shown = useMemo(
    () =>
      status === ""
        ? (quotes ?? [])
        : (quotes ?? []).filter((quote) => quote.status === status),
    [quotes, status],
  );

  return (
    <>
      <PageHeader
        title="Quotes"
        meta={
          quotes === undefined || quotes.length === 0
            ? "Requests from the website's quote form."
            : `${countOf(quotes.length, "request")} from the website`
        }
      />

      {quotes === undefined ? (
        <LoadingState />
      ) : quotes.length === 0 ? (
        <EmptyState title="No quote requests yet">
          Requests sent from the website&rsquo;s quote form land here, with
          their photos and the draft estimate.
        </EmptyState>
      ) : (
        <>
          {statuses.length > 1 ? (
            // biome-ignore lint/a11y/useSemanticElements: role=group is valid; <fieldset> brings UA layout quirks to the flex row.
            <div
              className="admin-filters"
              role="group"
              aria-label="Filter quotes by status"
            >
              <button
                type="button"
                className={
                  status === ""
                    ? "admin-filter admin-filter--on"
                    : "admin-filter"
                }
                aria-pressed={status === ""}
                onClick={() => setStatus("")}
              >
                All<span className="admin-filter__count">{quotes.length}</span>
              </button>
              {statuses.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  className={
                    status === name
                      ? "admin-filter admin-filter--on"
                      : "admin-filter"
                  }
                  aria-pressed={status === name}
                  onClick={() => setStatus(name)}
                >
                  {name}
                  <span className="admin-filter__count">{count}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="admin-list">
            {shown.map((quote) => (
              <button
                key={quote._id}
                type="button"
                className="admin-row"
                onClick={() => onOpen(quote._id)}
              >
                <span className="admin-row__main">
                  <span className="admin-row__title">
                    {quote.name}
                    {quote.company ? ` · ${quote.company}` : ""}
                  </span>
                  <span className="admin-row__meta">
                    {quote.jobType} ·{" "}
                    {new Date(quote.createdAt).toLocaleDateString("en-US")} ·{" "}
                    {quote.slot}
                    {quote.fileCount > 0
                      ? ` · ${quote.fileCount} file${quote.fileCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </span>
                {quote.invoiceNumber !== undefined ? (
                  <span className="adm-tag">{quote.invoiceNumber}</span>
                ) : null}
                {quote.dollarsLow !== undefined &&
                quote.dollarsHigh !== undefined ? (
                  <span className="admin-row__amount">
                    {formatMoney(quote.dollarsLow * 100)}–
                    {formatMoney(quote.dollarsHigh * 100)}
                  </span>
                ) : null}
                <StatusMark status={quote.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Loads one quote (with its download links) and hands it to the presentational
 * detail view, which is where the layout and its tests live. The two mutations
 * are driven from here so the detail view stays free of queries. */
function QuoteInbox({
  token,
  id,
  onBack,
  onOpenCustomer,
  onOpenInvoice,
}: {
  token: string;
  id: Id<"quotes">;
  onBack: () => void;
  onOpenCustomer: (id: Id<"customers">) => void;
  onOpenInvoice: (id: Id<"invoices">) => void;
}) {
  const quote = useQuery(api.adminQuotes.get, { token, id });
  const createCustomer = useMutation(api.adminQuotes.createCustomerFromQuote);
  const createInvoice = useMutation(api.adminQuotes.createInvoiceFromQuote);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameConflict, setNameConflict] = useState<{
    customerId: string;
    customerName: string;
  } | null>(null);

  /** The mutation answers "nameTaken" without writing anything when the name
   * is already in the book; that answer becomes the question on screen. */
  const saveCustomer = useCallback(
    async (choice?: { linkTo?: string; createAnyway?: boolean }) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        const result = await createCustomer({
          token,
          id,
          ...(choice?.linkTo === undefined
            ? {}
            : { linkTo: choice.linkTo as Id<"customers"> }),
          ...(choice?.createAnyway === true ? { createAnyway: true } : {}),
        });
        if (result.outcome === "nameTaken") {
          setNameConflict({
            customerId: result.customerId,
            customerName: result.customerName,
          });
        } else {
          setNameConflict(null);
        }
      } catch {
        setError("Could not save that customer. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, createCustomer, token, id],
  );

  const raiseInvoice = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onOpenInvoice(await createInvoice({ token, id }));
    } catch {
      setError("Could not raise an invoice from this quote.");
    } finally {
      setBusy(false);
    }
  }, [busy, createInvoice, token, id, onOpenInvoice]);

  if (quote === undefined) return <LoadingState rows={4} />;
  if (quote === null)
    return (
      <EmptyState title="That quote is gone">
        <button type="button" className="admin-linkish" onClick={onBack}>
          Back to quotes
        </button>
      </EmptyState>
    );
  return (
    <QuoteDetail
      quote={quote}
      onBack={onBack}
      actions={{
        busy,
        error,
        nameConflict,
        onCreateCustomer: () => void saveCustomer(),
        onLinkExistingCustomer: () =>
          void saveCustomer({ linkTo: nameConflict?.customerId }),
        onCreateSeparateCustomer: () =>
          void saveCustomer({ createAnyway: true }),
        onCreateInvoice: () => void raiseInvoice(),
        onOpenCustomer: (customerId) =>
          onOpenCustomer(customerId as Id<"customers">),
        onOpenInvoice: (invoiceId) =>
          onOpenInvoice(invoiceId as Id<"invoices">),
      }}
    />
  );
}

/* ------------------------------------------------------------ customers --- */

function CustomerList({
  token,
  onOpen,
}: {
  token: string;
  onOpen: (id: Id<"customers">) => void;
}) {
  const customers = useQuery(api.customers.list, { token });
  const create = useMutation(api.customers.create);
  const [form, setForm] = useState({
    name: "",
    company: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
  });
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <PageHeader
        title="Customers"
        meta={
          customers === undefined || customers.length === 0
            ? "Everyone the shop bills."
            : `${customers.length} saved`
        }
      />

      <section className="admin-card" aria-labelledby="new-customer">
        <h2 className="admin-card__title" id="new-customer">
          Add a customer
        </h2>
        <div className="admin-grid-2">
          <Input
            label="Name"
            value={form.name}
            onChange={set("name")}
            required
          />
          <Input
            label="Company"
            value={form.company}
            onChange={set("company")}
          />
          <Input
            label="Contact"
            value={form.contact}
            onChange={set("contact")}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={set("phone")}
            inputMode="tel"
          />
          <Input
            label="Email"
            value={form.email}
            onChange={set("email")}
            inputMode="email"
          />
          <Input
            label="Address"
            value={form.address}
            onChange={set("address")}
          />
        </div>
        <div className="admin-actions">
          <Button
            onClick={async () => {
              setError("");
              try {
                await create({ token, ...form });
                setForm({
                  name: "",
                  company: "",
                  contact: "",
                  phone: "",
                  email: "",
                  address: "",
                });
              } catch {
                setError("A customer needs at least a name.");
              }
            }}
          >
            <Icon name="plus" /> Save customer
          </Button>
        </div>
        {error ? (
          <p className="admin-gate__error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {customers === undefined ? (
        <LoadingState />
      ) : customers.length === 0 ? (
        <EmptyState title="No customers saved yet">
          Add one above, or save one straight from a quote request.
        </EmptyState>
      ) : (
        <div className="admin-list">
          {customers.map((customer) => (
            <button
              key={customer._id}
              type="button"
              className="admin-row"
              onClick={() => onOpen(customer._id)}
            >
              <span className="admin-row__main">
                <span className="admin-row__title">{customer.name}</span>
                <span className="admin-row__meta">
                  {[customer.company, customer.phone]
                    .filter(Boolean)
                    .join(" · ") || "No contact details"}
                </span>
              </span>
              <Icon name="chevron-right" className="admin-row__chev" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function CustomerDetail({
  token,
  id,
  onBack,
  onOpenInvoice,
}: {
  token: string;
  id: Id<"customers">;
  onBack: () => void;
  onOpenInvoice: (id: Id<"invoices">) => void;
}) {
  const summary = useQuery(api.customers.summary, { token, id });
  const invoices = useQuery(api.invoices.listForCustomer, {
    token,
    customerId: id,
  });

  if (summary === undefined) return <LoadingState rows={4} />;

  return (
    <>
      <PageHeader
        back={{ label: "All customers", onClick: onBack }}
        title={summary.customer.name}
        meta={summary.customer.company}
        aside={
          <span className="adm-figure">
            {formatMoney(summary.billedCents)} billed
          </span>
        }
      />

      <section className="admin-card">
        <h2 className="admin-card__title">Details</h2>
        <p className="admin-note">
          {[
            summary.customer.company,
            summary.customer.contact,
            summary.customer.phone,
            summary.customer.email,
            summary.customer.address,
          ]
            .filter(Boolean)
            .join(" · ") || "No details saved."}
        </p>
      </section>

      <h2 className="adm-section-title">Invoices</h2>
      {invoices === undefined ? (
        <LoadingState />
      ) : invoices.length === 0 ? (
        <EmptyState title="Nothing billed to this customer yet" />
      ) : (
        <div className="admin-list">
          {invoices.map((invoice) => (
            <button
              key={invoice._id}
              type="button"
              className="admin-row"
              onClick={() => onOpenInvoice(invoice._id)}
            >
              <span className="admin-row__main">
                <span className="admin-row__title">{invoice.number}</span>
                <span className="admin-row__meta">
                  {new Date(invoice.issuedAt).toLocaleDateString("en-US")}
                </span>
              </span>
              <span className="admin-row__amount">
                {formatMoney(invoice.totals.balanceCents)}
              </span>
              <StatusMark status={invoice.status} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- editor --- */

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

function InvoiceEditor({
  token,
  id,
  onBack,
  onOpenQuote,
  onOpenSlip,
}: {
  token: string;
  id: Id<"invoices">;
  onBack: () => void;
  onOpenQuote: (id: Id<"quotes">) => void;
  onOpenSlip: (id: Id<"packingSlips">) => void;
}) {
  const invoice = useQuery(api.invoices.get, { token, id });
  const laborRate = useQuery(api.settings.getLaborRateAdmin, { token });
  const update = useMutation(api.invoices.update);
  const setStatus = useMutation(api.invoices.setStatus);
  const generatePdf = useAction(api.invoicePdfAction.generate);
  const makeSlip = useMutation(api.packingSlips.createFromInvoice);

  const [lines, setLines] = useState<EditorLine[] | null>(null);
  const [saved, setSaved] = useState(true);
  const [jobPoEdit, setJobPoEdit] = useState<string | null>(null);
  const [dueDateEdit, setDueDateEdit] = useState<string | null>(null);
  const [notesEdit, setNotesEdit] = useState<string | null>(null);

  // Seeded from the server until Eric types, same as the line items.
  const jobPo = jobPoEdit ?? invoice?.jobPo ?? "";
  const dueDate =
    dueDateEdit ??
    (invoice?.dueAt === undefined ? "" : toDateInputValue(invoice.dueAt));

  const notes = notesEdit ?? invoice?.notes ?? "";

  const setJobPo = setJobPoEdit;
  const setDueDate = setDueDateEdit;

  // Seed the editor from the server exactly once, then it is the local source
  // of truth until saved — otherwise every keystroke would fight the query.
  const editorLines: EditorLine[] = useMemo(
    () =>
      lines ??
      (invoice
        ? invoice.lineItems.length > 0
          ? invoice.lineItems.map((line, i) => ({
              key: `seed-${i}`,
              qty: String(line.qty),
              unit: line.unit,
              description: line.description,
              rate: (line.rateCents / 100).toFixed(2),
              taxable: line.taxable,
            }))
          : [emptyLine("seed-0")]
        : []),
    [lines, invoice],
  );

  const save = useCallback(async () => {
    const payload = editorLines
      .filter(
        (line) => line.description.trim() !== "" || line.rate.trim() !== "",
      )
      .map((line) => ({
        qty: Number(line.qty) || 0,
        unit: line.unit,
        description: line.description.trim(),
        rateCents: parseMoneyToCents(line.rate) ?? 0,
        taxable: line.taxable,
      }));
    await update({
      token,
      id,
      lineItems: payload,
      jobPo: jobPo.trim(),
      // Untouched notes stay as stored, so a note saved before the box had a
      // limit cannot block saving the rest of the invoice.
      ...(notesEdit === null ? {} : { notes: notesEdit.trim() }),
      ...(fromDateInputValue(dueDate) === null
        ? {}
        : { dueAt: fromDateInputValue(dueDate) as number }),
    });
    setSaved(true);
  }, [editorLines, update, token, id, jobPo, notesEdit, dueDate]);

  const download = useCallback(async () => {
    // Save first so the PDF can never disagree with what is on screen.
    await save();
    return await generatePdf({ token, id });
  }, [save, generatePdf, token, id]);

  if (invoice === undefined) return <LoadingState rows={5} />;
  if (invoice === null)
    return (
      <EmptyState title="That invoice is gone">
        <button type="button" className="admin-linkish" onClick={onBack}>
          Back to invoices
        </button>
      </EmptyState>
    );

  // Pulled out so the click handler closes over a value TypeScript has already
  // narrowed, rather than re-reading a nullable field.
  const fromQuote = invoice.quote;

  return (
    <>
      <PageHeader
        back={{ label: "All invoices", onClick: onBack }}
        title={invoice.number}
        meta={invoice.customer.name}
        aside={
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={invoice.status}
            onChange={(value) =>
              void setStatus({
                token,
                id,
                status: value as "draft" | "sent" | "paid" | "void",
              })
            }
          />
        }
      />

      {fromQuote === null ? null : (
        <p className="admin-note admin-origin">
          Raised from quote request{" "}
          <button
            type="button"
            className="admin-linkish"
            onClick={() => onOpenQuote(fromQuote._id)}
          >
            {fromQuote.requestId}
          </button>{" "}
          · {fromQuote.name}
        </p>
      )}

      <div className="admin-card">
        <h2 className="admin-card__title">Job details</h2>
        <div className="admin-grid-2">
          <Input
            label="Job / PO #"
            value={jobPo}
            onChange={(value) => {
              setJobPo(value);
              setSaved(false);
            }}
          />
          <Input
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(value) => {
              setDueDate(value);
              setSaved(false);
            }}
          />
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Work and materials</h2>
        <LineItemEditor
          lines={editorLines}
          laborRate={laborRate ?? null}
          onChange={(next) => {
            setLines(next);
            setSaved(false);
          }}
        />
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Notes</h2>
        <NotesField
          label="Notes / work performed"
          box={INVOICE_NOTES}
          value={notes}
          onChange={(value) => {
            setNotesEdit(value);
            setSaved(false);
          }}
        />
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Totals</h2>
        <div className="admin-totals">
          <div className="admin-total-row">
            <span className="admin-total-row__label">Subtotal</span>
            <span className="admin-total-row__value">
              {formatMoney(invoice.totals.subtotalCents)}
            </span>
          </div>
          <div className="admin-total-row">
            <span className="admin-total-row__label">
              Tax rate {(invoice.taxRateBasisPoints / 100).toFixed(2)}%
            </span>
            <span className="admin-total-row__value">
              {formatMoney(invoice.totals.taxCents)}
            </span>
          </div>
          <div className="admin-total-row admin-total-row--balance">
            <span className="admin-total-row__label">Balance due</span>
            <span className="admin-total-row__value">
              {formatMoney(invoice.totals.balanceCents)}
            </span>
            <span className="adm-dimension" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="admin-actions">
        <Button
          variant="secondary"
          onClick={() => void save()}
          disabled={saved}
        >
          {saved ? "Saved" : "Save changes"}
        </Button>
        <DownloadPdfButton
          generate={download}
          filename={`${invoice.number}.pdf`}
        />
        <Button
          variant="secondary"
          onClick={async () => {
            await save();
            onOpenSlip(await makeSlip({ token, invoiceId: id }));
          }}
        >
          <Icon name="truck" /> Make packing slip
        </Button>
      </div>

      <div className="admin-sticky-total">
        <span className="admin-sticky-total__label">Balance due</span>
        <span className="admin-sticky-total__value">
          {formatMoney(invoice.totals.balanceCents)}
        </span>
      </div>
    </>
  );
}
