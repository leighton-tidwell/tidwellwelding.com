"use client";

import { useId } from "react";
import { Button, Checkbox, Icon, Input, Select } from "@/components/ds";
import {
  formatMoney,
  parseMoneyToCents,
  type LineUnit,
} from "@/lib/invoice-format";

/** A line as the form holds it: every numeric field stays a string while the
 * owner is typing, so a half-typed "1." is never coerced into nonsense. */
export type EditorLine = {
  key: string;
  qty: string;
  unit: LineUnit;
  description: string;
  rate: string;
  taxable: boolean;
};

const UNIT_OPTIONS: { value: LineUnit; label: string }[] = [
  { value: "hr", label: "hr — labour by the hour" },
  { value: "ea", label: "ea — parts, equipment, one-offs" },
  { value: "ft", label: "ft — material by length" },
  { value: "lb", label: "lb — material by weight" },
  { value: "lot", label: "lot — flat charge, fuel or travel" },
];

export function emptyLine(key: string): EditorLine {
  return {
    key,
    qty: "1",
    unit: "ea",
    description: "",
    rate: "",
    taxable: true,
  };
}

/** The amount for a line, or null when the numbers are not yet usable. */
export function lineAmountCentsOrNull(line: EditorLine): number | null {
  const qty = Number(line.qty);
  const rateCents = parseMoneyToCents(line.rate);
  if (!Number.isFinite(qty) || qty < 0 || rateCents === null) return null;
  return Math.round(qty * rateCents);
}

export type LineItemEditorProps = {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  /** The configured shop rate, used only to prefill a new hourly line. */
  laborRate: number | null;
};

export default function LineItemEditor({
  lines,
  onChange,
  laborRate,
}: LineItemEditorProps) {
  const idBase = useId();

  const update = (index: number, patch: Partial<EditorLine>) => {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  /** Switching a line to hours prefills the rate, but only when the field is
   * empty — a number already typed is the owner's decision and stands. The
   * rate most recently used on this invoice wins over the shop default, so a
   * job negotiated at a different rate is typed once, not once per line. */
  const handleUnitChange = (index: number, unit: LineUnit) => {
    const line = lines[index];
    if (unit !== "hr" || line.rate.trim() !== "") {
      update(index, { unit });
      return;
    }
    const priorHourly = lines
      .slice(0, index)
      .reverse()
      .find((l) => l.unit === "hr" && l.rate.trim() !== "");
    const prefill =
      priorHourly?.rate ?? (laborRate === null ? "" : String(laborRate));
    update(index, { unit, rate: prefill });
  };

  return (
    <div className="admin-lines">
      {lines.map((line, index) => {
        const amount = lineAmountCentsOrNull(line);
        const rowId = `${idBase}-${line.key}`;
        return (
          <div
            key={line.key}
            role="group"
            aria-label={`Line item ${index + 1}`}
            className="admin-line"
          >
            <div className="admin-line-grid">
              <Input
                label="Qty"
                id={`${rowId}-qty`}
                value={line.qty}
                inputMode="decimal"
                onChange={(value) => update(index, { qty: value })}
                className="admin-line-qty"
              />
              <Select
                label="Unit"
                id={`${rowId}-unit`}
                value={line.unit}
                options={UNIT_OPTIONS}
                onChange={(value) => handleUnitChange(index, value as LineUnit)}
                className="admin-line-unit"
              />
              <Input
                label="Description of work / materials"
                id={`${rowId}-desc`}
                value={line.description}
                onChange={(value) => update(index, { description: value })}
                className="admin-line-desc"
              />
              <Input
                label="Rate"
                id={`${rowId}-rate`}
                value={line.rate}
                inputMode="decimal"
                adornment="$"
                onChange={(value) => update(index, { rate: value })}
                className="admin-line-rate"
              />
            </div>

            <div className="admin-line-foot">
              <Checkbox
                label="Tax"
                checked={line.taxable}
                onChange={(checked) => update(index, { taxable: checked })}
              />
              <span
                className="admin-line-amount"
                aria-label={`Line ${index + 1} amount`}
              >
                {amount === null ? "—" : formatMoney(amount)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={lines.length <= 1}
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
                aria-label={`Remove line ${index + 1}`}
              >
                <Icon name="x" /> Remove
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        variant="secondary"
        onClick={() => onChange([...lines, emptyLine(`line-${Date.now()}`)])}
      >
        <Icon name="plus" /> Add line
      </Button>
    </div>
  );
}
