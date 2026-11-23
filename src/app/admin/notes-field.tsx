"use client";

import { Input } from "@/components/ds";
import {
  clipNote,
  type NoteBox,
  noteFits,
  printableNote,
  wrapNote,
} from "../../../convex/noteLines";

/**
 * The notes box of a printed document. It takes only what fits on the ruled
 * lines of the PDF, the way `maxLength` caps a plain field, and the hint counts
 * lines as they fill.
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
        used > box.lines
          ? `Too long: ${used} lines, and ${box.lines} print. Shorten it to save.`
          : used === box.lines
            ? `On the last of ${box.lines} printed lines`
            : `${used} of ${box.lines} printed lines used`
      }
      onChange={(typed) => {
        const next = printableNote(typed);
        // Deleting is always allowed, so an older over-long note can be cut
        // down. Text added at the end is cut where the lines run out. Text
        // added anywhere else to a full note is refused outright, because
        // clipping it would silently delete the end of what is there.
        const accepted =
          noteFits(next, box) || next.length < value.length
            ? next
            : noteFits(value, box) && next.startsWith(value)
              ? clipNote(next, box)
              : value;
        if (accepted !== value) onChange(accepted);
      }}
    />
  );
}
