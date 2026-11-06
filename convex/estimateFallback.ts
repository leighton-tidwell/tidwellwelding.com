import { CNC_TYPE } from "./uploadRules";

/** The static draft shown when the AI estimate fails or is unavailable.
 * Pure (no server imports) so the quote form can use the same draft when the
 * backend is unreachable. Dollars are added server-side only. */
export type FallbackDraft = {
  title: string;
  summary: string;
  line_items: { task: string; crew: number; hours: number }[];
  hours_low: number;
  hours_high: number;
  confidence: "low";
  questions: string[];
};

export function fallbackDraft(jobType: string): FallbackDraft {
  const base = {
    title: "Draft estimate",
    summary:
      "A working draft based on jobs like yours. Eric firms up the numbers on the callback.",
    // The static fallback is a guess by definition: hours show, dollars wait
    // for Eric.
    confidence: "low" as const,
  };
  // CNC is shop work cut from a drawing: no weld-out, no site visit.
  if (jobType === CNC_TYPE) {
    return {
      ...base,
      line_items: [
        { task: "Layout and file prep", crew: 1, hours: 1 },
        { task: "Plasma cutting", crew: 1, hours: 1.5 },
        { task: "Cleanup and deburr", crew: 1, hours: 0.5 },
      ],
      hours_low: 2,
      hours_high: 5,
      questions: [
        "The drawing or file to cut from",
        "Material and thickness",
        "Finished size and quantity",
      ],
    };
  }
  const mobile =
    jobType === "Mobile / on-site repair" || jobType === "Emergency";
  const items = [
    { task: "Assess, prep and fit-up", crew: 1, hours: 2 },
    { task: "Weld-out", crew: 1, hours: 4 },
    { task: "Grind, dress and inspect", crew: 1, hours: 1 },
  ];
  if (mobile)
    items.unshift({ task: "Mobilize the truck to site", crew: 1, hours: 1 });
  return {
    ...base,
    line_items: items,
    hours_low: 6,
    hours_high: 10,
    questions: ["Exact sizes and material thickness", "Site access and power"],
  };
}
