"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Badge, Button, Icon, Input } from "@/components/ds";
import { formatMoney } from "@/lib/invoice-format";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

/**
 * A customer as a business: who to talk to there, who that used to be, and
 * everything billed or shipped to them. Functional styling only; the admin
 * shell redesign restyles it.
 */
export default function BusinessDetail({
  token,
  customerId,
  onBack,
  onOpenInvoice,
  onOpenSlip,
}: {
  token: string;
  customerId: Id<"customers">;
  onBack: () => void;
  onOpenInvoice: (id: Id<"invoices">) => void;
  onOpenSlip: (id: Id<"packingSlips">) => void;
}) {
  const businessId = useQuery(api.businesses.forCustomer, {
    token,
    customerId,
  });
  const ensure = useMutation(api.businesses.ensureForCustomer);

  const back = (
    <div className="admin-actions" style={{ marginTop: 0, marginBottom: 12 }}>
      <Button variant="quiet" size="sm" onClick={onBack}>
        <Icon name="arrow-left" /> All customers
      </Button>
    </div>
  );

  if (businessId === undefined) return <p className="admin-note">Loading…</p>;
  if (businessId === null) {
    // Only a customer the backfill has not reached yet lands here.
    return (
      <>
        {back}
        <p className="admin-empty">This customer has no contacts set up yet.</p>
        <div className="admin-actions">
          <Button onClick={() => void ensure({ token, customerId })}>
            Set up contacts
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      {back}
      <BusinessPage
        token={token}
        id={businessId}
        onOpenInvoice={onOpenInvoice}
        onOpenSlip={onOpenSlip}
      />
    </>
  );
}

function BusinessPage({
  token,
  id,
  onOpenInvoice,
  onOpenSlip,
}: {
  token: string;
  id: Id<"businesses">;
  onOpenInvoice: (id: Id<"invoices">) => void;
  onOpenSlip: (id: Id<"packingSlips">) => void;
}) {
  const page = useQuery(api.businesses.get, { token, id });
  if (page === undefined) return <p className="admin-note">Loading…</p>;
  if (page === null)
    return <p className="admin-empty">That business no longer exists.</p>;

  const { business, contacts, history, invoices, packingSlips } = page;
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Business</p>
          <h1 className="admin-title">{business.name}</h1>
        </div>
        {business.status === "archived" ? (
          <Badge variant="idle">Archived</Badge>
        ) : null}
      </div>

      <DetailsCard token={token} business={business} />
      <ContactsCard token={token} business={business} contacts={contacts} />

      <div className="admin-card">
        <h2 className="admin-card__title">Primary contact history</h2>
        {history.length === 0 ? (
          <p className="admin-note">No changes yet.</p>
        ) : (
          <ul className="admin-list">
            {history.map((row) => (
              <li key={row._id} className="admin-row">
                <span className="admin-row__main">
                  <span className="admin-row__title">
                    {row.from ? `${row.from} → ` : "Set to "}
                    {row.to ?? "nobody"}
                  </span>
                  <span className="admin-row__meta">
                    {new Date(row.changedAt).toLocaleDateString("en-US")}
                    {" · "}
                    {row.changedBy ?? "Imported"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="admin-card__title">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="admin-empty">Nothing billed to this business yet.</p>
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
              {invoice.amounts ? (
                <span className="admin-row__amount">
                  {formatMoney(invoice.amounts.balanceCents)}
                </span>
              ) : null}
              <span className={`admin-status admin-status--${invoice.status}`}>
                {invoice.status}
              </span>
            </button>
          ))}
        </div>
      )}

      <h2 className="admin-card__title" style={{ marginTop: 24 }}>
        Packing slips
      </h2>
      {packingSlips.length === 0 ? (
        <p className="admin-empty">Nothing shipped to this business yet.</p>
      ) : (
        <div className="admin-list">
          {packingSlips.map((slip) => (
            <button
              key={slip._id}
              type="button"
              className="admin-row"
              onClick={() => onOpenSlip(slip._id)}
            >
              <span className="admin-row__main">
                <span className="admin-row__title">{slip.number}</span>
                <span className="admin-row__meta">
                  {new Date(slip.shippedAt).toLocaleDateString("en-US")}
                  {slip.invoiced ? " · Invoiced" : ""}
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

function DetailsCard({
  token,
  business,
}: {
  token: string;
  business: Doc<"businesses">;
}) {
  const update = useMutation(api.businesses.update);
  const [form, setForm] = useState({
    name: business.name,
    address: business.address ?? "",
    notes: business.notes ?? "",
  });
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Details</h2>
      <div className="admin-grid-2">
        <Input label="Name" value={form.name} onChange={set("name")} required />
        <Input
          label="Billing address"
          value={form.address}
          onChange={set("address")}
        />
      </div>
      <Input label="Notes" value={form.notes} onChange={set("notes")} />
      <div className="admin-actions">
        <Button
          variant="secondary"
          onClick={async () => {
            setError("");
            try {
              await update({ token, id: business._id, ...form });
            } catch {
              setError("A business needs a name.");
            }
          }}
        >
          Save details
        </Button>
        <Button
          variant="quiet"
          onClick={() =>
            void update({
              token,
              id: business._id,
              status: business.status === "active" ? "archived" : "active",
            })
          }
        >
          {business.status === "active" ? "Archive" : "Restore"}
        </Button>
      </div>
      {error ? (
        <p className="admin-gate__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const EMPTY_CONTACT = { name: "", title: "", email: "", phone: "" };

function ContactsCard({
  token,
  business,
  contacts,
}: {
  token: string;
  business: Doc<"businesses">;
  contacts: Doc<"contacts">[];
}) {
  const add = useMutation(api.businesses.addContact);
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [editing, setEditing] = useState<Id<"contacts"> | null>(null);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Contacts</h2>
      {contacts.length === 0 ? (
        <p className="admin-note">Nobody on file yet.</p>
      ) : (
        <ul className="admin-list">
          {contacts.map((contact) =>
            editing === contact._id ? (
              <li key={contact._id}>
                <ContactEditor
                  token={token}
                  contact={contact}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <ContactRow
                key={contact._id}
                token={token}
                business={business}
                contact={contact}
                onEdit={() => setEditing(contact._id)}
                onError={setError}
              />
            ),
          )}
        </ul>
      )}

      <h3 className="admin-eyebrow" style={{ marginTop: 16 }}>
        Add a contact
      </h3>
      <div className="admin-grid-2">
        <Input label="Name" value={form.name} onChange={set("name")} required />
        <Input label="Title" value={form.title} onChange={set("title")} />
        <Input
          label="Email"
          value={form.email}
          onChange={set("email")}
          inputMode="email"
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={set("phone")}
          inputMode="tel"
        />
      </div>
      <div className="admin-actions">
        <Button
          variant="secondary"
          onClick={async () => {
            setError("");
            try {
              await add({ token, businessId: business._id, ...form });
              setForm(EMPTY_CONTACT);
            } catch {
              setError("A contact needs at least a name.");
            }
          }}
        >
          <Icon name="plus" /> Add contact
        </Button>
      </div>
      {error ? (
        <p className="admin-gate__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ContactRow({
  token,
  business,
  contact,
  onEdit,
  onError,
}: {
  token: string;
  business: Doc<"businesses">;
  contact: Doc<"contacts">;
  onEdit: () => void;
  onError: (message: string) => void;
}) {
  const setPrimary = useMutation(api.businesses.setPrimaryContact);
  const setActive = useMutation(api.businesses.setContactActive);
  const isPrimary = business.primaryContactId === contact._id;

  const run = async (call: () => Promise<unknown>, message: string) => {
    onError("");
    try {
      await call();
    } catch {
      onError(message);
    }
  };

  return (
    <li className="admin-row" style={{ cursor: "default" }}>
      <span className="admin-row__main">
        <span className="admin-row__title">
          {contact.name}
          {contact.title ? ` · ${contact.title}` : ""}
        </span>
        <span className="admin-row__meta">
          {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
            "No email or phone"}
        </span>
      </span>
      {isPrimary ? <Badge variant="accent">Primary</Badge> : null}
      {!contact.active ? <Badge variant="idle">Inactive</Badge> : null}
      <Button variant="quiet" size="sm" onClick={onEdit}>
        Edit
      </Button>
      {!isPrimary && contact.active ? (
        <Button
          variant="quiet"
          size="sm"
          onClick={() =>
            void run(
              () =>
                setPrimary({
                  token,
                  businessId: business._id,
                  contactId: contact._id,
                }),
              "Could not change the primary contact.",
            )
          }
        >
          Make primary
        </Button>
      ) : null}
      {!isPrimary ? (
        <Button
          variant="quiet"
          size="sm"
          onClick={() =>
            void run(
              () =>
                setActive({ token, id: contact._id, active: !contact.active }),
              "Could not update that contact.",
            )
          }
        >
          {contact.active ? "Deactivate" : "Reactivate"}
        </Button>
      ) : null}
    </li>
  );
}

function ContactEditor({
  token,
  contact,
  onDone,
}: {
  token: string;
  contact: Doc<"contacts">;
  onDone: () => void;
}) {
  const update = useMutation(api.businesses.updateContact);
  const [form, setForm] = useState({
    name: contact.name,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
  });
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="admin-card">
      <div className="admin-grid-2">
        <Input label="Name" value={form.name} onChange={set("name")} required />
        <Input label="Title" value={form.title} onChange={set("title")} />
        <Input
          label="Email"
          value={form.email}
          onChange={set("email")}
          inputMode="email"
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={set("phone")}
          inputMode="tel"
        />
      </div>
      <div className="admin-actions">
        <Button
          size="sm"
          onClick={async () => {
            setError("");
            try {
              await update({ token, id: contact._id, ...form });
              onDone();
            } catch {
              setError("A contact needs at least a name.");
            }
          }}
        >
          Save contact
        </Button>
        <Button variant="quiet" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="admin-gate__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
