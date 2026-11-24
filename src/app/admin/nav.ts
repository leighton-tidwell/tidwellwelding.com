import type { IconName } from "@/components/ds/icon";

/**
 * Every section the console will have, in the order the nav shows them. This
 * is the one list the sidebar and the phone tab bar both render from.
 *
 * `ready: false` reserves a slot for a section that is planned but not built
 * yet (docs/admin-rbac-jobs.md); it never renders. When roles land, each item
 * names the permission that unlocks it and `visibleSections` filters by it, so
 * the shell itself needs no change.
 */
export type SectionId =
  | "today"
  | "jobs"
  | "businesses"
  | "quotes"
  | "invoices"
  | "slips"
  | "customers"
  | "people"
  | "time"
  | "settings";

export type Section = {
  id: SectionId;
  label: string;
  icon: IconName;
  ready: boolean;
  /** The permission that will gate this section. Unchecked until RBAC ships. */
  permission?: string;
};

export const SECTIONS: readonly Section[] = [
  { id: "today", label: "Today", icon: "sun", ready: false },
  { id: "jobs", label: "Jobs", icon: "wrench", ready: false },
  { id: "businesses", label: "Businesses", icon: "building", ready: false },
  { id: "quotes", label: "Quotes", icon: "inbox", ready: true },
  { id: "invoices", label: "Invoices", icon: "receipt", ready: true },
  { id: "slips", label: "Packing slips", icon: "truck", ready: true },
  // Folds into Businesses once that screen ships (docs/admin-rbac-jobs.md,
  // PR 2); retire this slot then rather than showing both.
  { id: "customers", label: "Customers", icon: "book-user", ready: true },
  { id: "people", label: "People", icon: "users", ready: false },
  { id: "time", label: "Time", icon: "clock", ready: false },
  { id: "settings", label: "Settings", icon: "settings", ready: false },
];

/** The sections this user should see: built ones they are allowed into. With
 * no `can` given, every built section shows, which is today's single-owner
 * console. */
export function visibleSections(
  can: (permission: string) => boolean = () => true,
  sections: readonly Section[] = SECTIONS,
): Section[] {
  return sections.filter(
    (section) =>
      section.ready &&
      (section.permission === undefined || can(section.permission)),
  );
}
