"use client";

import { Input } from "@/components/ds";
import {
  clipNote,
  type NoteBox,
  printableNote,
  wrapNote,
} from "../../../convex/noteLines";

/**
 * The notes box of a printed document. It takes only what fits on the ruled
 * lines of the PDF, the way `maxLength` caps a plain field: typing or pasting
 * past the last line is cut off there, and the hint counts lines as they fill.
 * Characters the PDF font cannot draw are dropped.
 */
export default function NotesField({
  label,
  box,
  value,
  onChange,
}: {
  label: string;
  box: NoteBox;
  value: string;
  onChange: (value: string) => void;
}) {
  const used = wrapNote(value, box.width).length;
  return (
    <Input
      label={label}
      multiline
      rows={box.lines}
      value={value}
      hint={
        used >= box.lines
          ? `On the last of ${box.lines} printed lines`
          : `${used} of ${box.lines} printed lines used`
      }
      onChange={(next) => {
        const fitted = clipNote(printableNote(next), box);
        if (fitted !== value) onChange(fitted);
      }}
    />
  );
}
