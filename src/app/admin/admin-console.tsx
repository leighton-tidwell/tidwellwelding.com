"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, HazardBar, Icon, Input, Select } from "@/components/ds";
import { fromDateInputValue, toDateInputValue } from "@/lib/invoice-dates";
import { formatMoney, parseMoneyToCents } from "@/lib/invoice-format";
import DownloadPdfButton from "./download-pdf-button";
import LineItemEditor, {
  emptyLine,
  type EditorLine,
} from "./line-item-editor";
import { useAdminSession } from "./use-admin-session";
import "./admin.css";

type View =
  | { name: "invoices" }
  | { name: "customers" }
  | { name: "customer"; id: Id<"customers"> }
  | { name: "invoice"; id: Id<"invoices"> };

export default function AdminConsole() {
  const { token, ready, signIn, signOut } = useAdminSession();

  if (!ready) return <div className="admin-shell" />;
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
    <div className="admin-gate">
      <form
        className="admin-gate__plate"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="admin-gate__title">Shop admin</h1>
        <p className="admin-gate__sub">Invoices for Tidwell Specialty Welding.</p>

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

function Console({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [view, setView] = useState<View>({ name: "invoices" });

  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <span className="admin-bar__brand">
          <Icon name="hard-hat" /> TSWS Admin
        </span>
        <span className="admin-bar__who">
          <Button variant="quiet" size="sm" onClick={onSignOut}>
            <Icon name="log-out" /> Sign out
          </Button>
        </span>
      </header>
      <HazardBar />

      <nav className="admin-main" aria-label="Sections" style={{ paddingBottom: 0 }}>
        <div className="admin-actions" style={{ marginTop: 0 }}>
          <Button
            variant={view.name === "invoices" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView({ name: "invoices" })}
          >
            Invoices
          </Button>
          <Button
            variant={view.name === "customers" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView({ name: "customers" })}
          >
            Customers
          </Button>
        </div>
      </nav>

      <main className="admin-main">
        {view.name === "invoices" && (
          <InvoiceList token={token} onOpen={(id) => setView({ name: "invoice", id })} />
        )}
        {view.name === "customers" && (
          <CustomerList token={token} onOpen={(id) => setView({ name: "customer", id })} />
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
          />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------- invoices --- */

function StatusPill({ status }: { status: string }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>;
}

function InvoiceList({
  token,
  onOpen,
}: {
  token: string;
  onOpen: (id: Id<"invoices">) => void;
}) {
  const invoices = useQuery(api.invoices.list, { token });
  const customers = useQuery(api.customers.list, { token });
  const create = useMutation(api.invoices.create);
  const [customerId, setCustomerId] = useState("");

  const options = useMemo(
    () => (customers ?? []).map((c) => ({ value: c._id, label: c.name })),
    [customers],
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Billing</p>
          <h1 className="admin-title">Invoices</h1>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Start a new invoice</h2>
        {options.length === 0 ? (
          <p className="admin-note">Add a customer first, then bill them here.</p>
        ) : (
          <div className="admin-grid-2">
            <Select
              label="Customer"
              options={options}
              placeholder="Pick a customer"
              value={customerId}
              onChange={setCustomerId}
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
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
                <Icon name="file-text" /> Create invoice
              </Button>
            </div>
          </div>
        )}
      </div>

      {invoices === undefined ? (
        <p className="admin-note">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="admin-empty">No invoices yet.</p>
      ) : (
        <div className="admin-list">
          {invoices.map((invoice) => (
            <button
              key={invoice._id}
              type="button"
              className="admin-row"
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
              <StatusPill status={invoice.status} />
            </button>
          ))}
        </div>
      )}
    </>
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
      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Who you bill</p>
          <h1 className="admin-title">Customers</h1>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Add a customer</h2>
        <div className="admin-grid-2">
          <Input label="Name" value={form.name} onChange={set("name")} required />
          <Input label="Company" value={form.company} onChange={set("company")} />
          <Input label="Contact" value={form.contact} onChange={set("contact")} />
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
          <Input label="Address" value={form.address} onChange={set("address")} />
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
      </div>

      {customers === undefined ? (
        <p className="admin-note">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="admin-empty">No customers saved yet.</p>
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
                  {[customer.company, customer.phone].filter(Boolean).join(" · ") ||
                    "No contact details"}
                </span>
              </span>
              <Icon name="chevron-right" />
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
  const invoices = useQuery(api.invoices.listForCustomer, { token, customerId: id });

  if (summary === undefined) return <p className="admin-note">Loading…</p>;

  return (
    <>
      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Button variant="quiet" size="sm" onClick={onBack}>
          <Icon name="arrow-left" /> All customers
        </Button>
      </div>

      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Customer</p>
          <h1 className="admin-title">{summary.customer.name}</h1>
        </div>
        <Badge>{formatMoney(summary.billedCents)} billed</Badge>
      </div>

      <div className="admin-card">
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
      </div>

      <h2 className="admin-card__title">Invoices</h2>
      {invoices === undefined ? (
        <p className="admin-note">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="admin-empty">Nothing billed to this customer yet.</p>
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
              <StatusPill status={invoice.status} />
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
}: {
  token: string;
  id: Id<"invoices">;
  onBack: () => void;
}) {
  const invoice = useQuery(api.invoices.get, { token, id });
  const laborRate = useQuery(api.settings.getLaborRateAdmin, { token });
  const update = useMutation(api.invoices.update);
  const setStatus = useMutation(api.invoices.setStatus);
  const generatePdf = useAction(api.invoicePdfAction.generate);

  const [lines, setLines] = useState<EditorLine[] | null>(null);
  const [saved, setSaved] = useState(true);
  const [jobPoEdit, setJobPoEdit] = useState<string | null>(null);
  const [dueDateEdit, setDueDateEdit] = useState<string | null>(null);

  // Seeded from the server until Eric types, same as the line items.
  const jobPo = jobPoEdit ?? invoice?.jobPo ?? "";
  const dueDate =
    dueDateEdit ??
    (invoice?.dueAt === undefined ? "" : toDateInputValue(invoice.dueAt));

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
      .filter((line) => line.description.trim() !== "" || line.rate.trim() !== "")
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
      ...(fromDateInputValue(dueDate) === null
        ? {}
        : { dueAt: fromDateInputValue(dueDate) as number }),
    });
    setSaved(true);
  }, [editorLines, update, token, id, jobPo, dueDate]);

  const download = useCallback(async () => {
    // Save first so the PDF can never disagree with what is on screen.
    await save();
    return await generatePdf({ token, id });
  }, [save, generatePdf, token, id]);

  if (invoice === undefined) return <p className="admin-note">Loading…</p>;
  if (invoice === null) return <p className="admin-empty">That invoice is gone.</p>;

  return (
    <>
      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Button variant="quiet" size="sm" onClick={onBack}>
          <Icon name="arrow-left" /> All invoices
        </Button>
      </div>

      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">{invoice.customer.name}</p>
          <h1 className="admin-title">{invoice.number}</h1>
        </div>
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
      </div>

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
          </div>
        </div>
        <p className="admin-note" style={{ marginTop: 12 }}>
          Tax defaults to the Granbury rate and applies only to lines marked
          taxable. Texas treats nonresidential repair work differently from new
          construction — check anything unusual with your accountant.
        </p>
      </div>

      <div className="admin-actions">
        <Button variant="secondary" onClick={() => void save()} disabled={saved}>
          {saved ? "Saved" : "Save changes"}
        </Button>
        <DownloadPdfButton
          generate={download}
          filename={`${invoice.number}.pdf`}
        />
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
