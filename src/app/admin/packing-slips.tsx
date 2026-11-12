"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { Button, Icon, Input, Select } from "@/components/ds";
import { fromDateInputValue, toDateInputValue } from "@/lib/invoice-dates";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import DownloadPdfButton from "./download-pdf-button";

type SlipLine = {
  key: string;
  partNumber: string;
  description: string;
  qty: string;
  unit: string;
};

const emptySlipLine = (key: string): SlipLine => ({
  key,
  partNumber: "",
  description: "",
  qty: "",
  unit: "ea",
});

type Form = {
  shipToName: string;
  shipToAddress: string;
  shipDate: string;
  poNumber: string;
  jobProject: string;
  shippedVia: string;
  tracking: string;
  packages: string;
  notes: string;
  lines: SlipLine[];
};

function formFrom(slip: Doc<"packingSlips">): Form {
  return {
    shipToName: slip.shipToName,
    shipToAddress: slip.shipToAddress ?? "",
    shipDate: toDateInputValue(slip.shippedAt),
    poNumber: slip.poNumber ?? "",
    jobProject: slip.jobProject ?? "",
    shippedVia: slip.shippedVia ?? "",
    tracking: slip.tracking ?? "",
    packages: slip.packages ?? "",
    notes: slip.notes ?? "",
    lines:
      slip.lineItems.length > 0
        ? slip.lineItems.map((line, i) => ({
            key: `seed-${i}`,
            partNumber: line.partNumber,
            description: line.description,
            qty: String(line.qty),
            unit: line.unit,
          }))
        : [emptySlipLine("seed-0")],
  };
}

export function PackingSlipList({
  token,
  onOpen,
}: {
  token: string;
  onOpen: (id: Id<"packingSlips">) => void;
}) {
  const slips = useQuery(api.packingSlips.list, { token });
  const customers = useQuery(api.customers.list, { token });
  const create = useMutation(api.packingSlips.create);
  const [customerId, setCustomerId] = useState("");
  const options = useMemo(
    () => (customers ?? []).map((c) => ({ value: c._id, label: c.name })),
    [customers],
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Shipping</p>
          <h1 className="admin-title">Packing slips</h1>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Start a new packing slip</h2>
        {options.length === 0 ? (
          <p className="admin-note">Add a customer first.</p>
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
                <Icon name="truck" /> Create packing slip
              </Button>
            </div>
          </div>
        )}
      </div>

      {slips === undefined ? (
        <p className="admin-note">Loading…</p>
      ) : slips.length === 0 ? (
        <p className="admin-empty">No packing slips yet.</p>
      ) : (
        <div className="admin-list">
          {slips.map((slip) => (
            <button
              key={slip._id}
              type="button"
              className="admin-row"
              onClick={() => onOpen(slip._id)}
            >
              <span className="admin-row__main">
                <span className="admin-row__title">{slip.number}</span>
                <span className="admin-row__meta">
                  {slip.customerName} → {slip.shipToName} ·{" "}
                  {slip.lineItems.length} line
                  {slip.lineItems.length === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function PackingSlipEditor({
  token,
  id,
  onBack,
  onOpenInvoice,
}: {
  token: string;
  id: Id<"packingSlips">;
  onBack: () => void;
  onOpenInvoice: (id: Id<"invoices">) => void;
}) {
  const slip = useQuery(api.packingSlips.get, { token, id });
  const update = useMutation(api.packingSlips.update);
  const generatePdf = useAction(api.packingSlipPdfAction.generate);
  const makeInvoice = useMutation(api.invoices.createFromPackingSlip);

  // Seeded from the server once, then local until saved, like the invoice.
  const [edit, setEdit] = useState<Form | null>(null);
  const [saved, setSaved] = useState(true);
  const form = edit ?? (slip ? formFrom(slip) : null);

  const set = (patch: Partial<Form>) => {
    if (!form) return;
    setEdit({ ...form, ...patch });
    setSaved(false);
  };
  const setLine = (index: number, patch: Partial<SlipLine>) =>
    set({
      lines: (form?.lines ?? []).map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    });

  const save = useCallback(async () => {
    if (!form) return;
    const shippedAt = fromDateInputValue(form.shipDate);
    await update({
      token,
      id,
      shipToName: form.shipToName.trim(),
      shipToAddress: form.shipToAddress.trim(),
      ...(shippedAt === null ? {} : { shippedAt }),
      poNumber: form.poNumber.trim(),
      jobProject: form.jobProject.trim(),
      shippedVia: form.shippedVia.trim(),
      tracking: form.tracking.trim(),
      packages: form.packages.trim(),
      notes: form.notes.trim(),
      lineItems: form.lines
        .filter(
          (line) =>
            line.partNumber.trim() !== "" || line.description.trim() !== "",
        )
        .map((line) => ({
          partNumber: line.partNumber.trim(),
          description: line.description.trim(),
          qty: Number(line.qty) || 0,
          unit: line.unit.trim(),
        })),
    });
    setSaved(true);
  }, [form, update, token, id]);

  const download = useCallback(async () => {
    await save();
    return await generatePdf({ token, id });
  }, [save, generatePdf, token, id]);

  if (slip === undefined || (slip && !form))
    return <p className="admin-note">Loading…</p>;
  if (slip === null || !form)
    return <p className="admin-empty">That packing slip is gone.</p>;

  const fromInvoice = slip.invoice;
  const field = (label: string, key: keyof Omit<Form, "lines">) => (
    <Input
      label={label}
      value={form[key]}
      onChange={(value) => set({ [key]: value })}
    />
  );

  return (
    <>
      <div className="admin-actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <Button variant="quiet" size="sm" onClick={onBack}>
          <Icon name="arrow-left" /> All packing slips
        </Button>
      </div>

      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">{slip.customerName}</p>
          <h1 className="admin-title">{slip.number}</h1>
        </div>
      </div>

      {fromInvoice === null ? null : (
        <p className="admin-note">
          Invoice{" "}
          <button
            type="button"
            className="admin-linkish"
            onClick={() => onOpenInvoice(fromInvoice._id)}
          >
            {fromInvoice.number}
          </button>
        </p>
      )}

      <div className="admin-card">
        <h2 className="admin-card__title">Ship to</h2>
        <div className="admin-grid-2">
          {field("Ship to", "shipToName")}
          {field("Delivery address", "shipToAddress")}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Shipment</h2>
        <div className="admin-grid-2">
          <Input
            label="Ship date"
            type="date"
            value={form.shipDate}
            onChange={(value) => set({ shipDate: value })}
          />
          {field("PO #", "poNumber")}
          {field("Job / project #", "jobProject")}
          {field("Shipped via", "shippedVia")}
          {field("Tracking / BOL #", "tracking")}
          {field("Total packages", "packages")}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">What shipped</h2>
        <div className="admin-lines">
          {form.lines.map((line, index) => (
            // biome-ignore lint/a11y/useSemanticElements: role=group is valid; <fieldset> brings UA layout quirks to the grid.
            <div
              key={line.key}
              role="group"
              aria-label={`Line item ${index + 1}`}
              className="admin-line"
            >
              <div className="admin-line-grid admin-line-grid--slip">
                <Input
                  label="Part / stock #"
                  value={line.partNumber}
                  onChange={(value) => setLine(index, { partNumber: value })}
                />
                <Input
                  label="Description"
                  value={line.description}
                  onChange={(value) => setLine(index, { description: value })}
                />
                <Input
                  label="Qty"
                  value={line.qty}
                  inputMode="decimal"
                  onChange={(value) => setLine(index, { qty: value })}
                />
                <Input
                  label="UOM"
                  value={line.unit}
                  onChange={(value) => setLine(index, { unit: value })}
                />
              </div>
              <div className="admin-line-foot">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={form.lines.length <= 1}
                  onClick={() =>
                    set({ lines: form.lines.filter((_, i) => i !== index) })
                  }
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Icon name="x" /> Remove
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              set({
                lines: [...form.lines, emptySlipLine(`line-${Date.now()}`)],
              })
            }
          >
            <Icon name="plus" /> Add line
          </Button>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card__title">Notes</h2>
        <Input
          label="Notes / instructions"
          multiline
          rows={3}
          value={form.notes}
          onChange={(value) => set({ notes: value })}
        />
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
          filename={`${slip.number}.pdf`}
        />
        {fromInvoice === null ? (
          <Button
            variant="secondary"
            onClick={async () => {
              await save();
              onOpenInvoice(await makeInvoice({ token, packingSlipId: id }));
            }}
          >
            <Icon name="file-text" /> Make invoice
          </Button>
        ) : null}
      </div>
    </>
  );
}
