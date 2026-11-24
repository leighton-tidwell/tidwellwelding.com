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

/** Headings the sidebar groups sections under, in order. The phone tab bar
 * ignores them and shows one flat row. */
export const GROUPS = [
  { id: "work", label: "Work" },
  { id: "billing", label: "Billing" },
  { id: "contacts", label: "Contacts" },
  { id: "team", label: "Team" },
  { id: "admin", label: "Admin" },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];

export type Section = {
  id: SectionId;
  label: string;
  icon: IconName;
  group: GroupId;
  ready: boolean;
  /** The permission that will gate this section. Unchecked until RBAC ships. */
  permission?: string;
};

export const SECTIONS: readonly Section[] = [
  { id: "today", label: "Today", icon: "sun", group: "work", ready: false },
  { id: "jobs", label: "Jobs", icon: "wrench", group: "work", ready: false },
  {
    id: "businesses",
    label: "Businesses",
    icon: "building",
    group: "contacts",
    ready: false,
  },
  { id: "quotes", label: "Quotes", icon: "inbox", group: "work", ready: true },
  {
    id: "invoices",
    label: "Invoices",
    icon: "receipt",
    group: "billing",
    ready: true,
  },
  {
    id: "slips",
    label: "Packing slips",
    icon: "truck",
    group: "billing",
    ready: true,
  },
  // Folds into Businesses once that screen ships (docs/admin-rbac-jobs.md,
  // PR 2); retire this slot then rather than showing both.
  {
    id: "customers",
    label: "Customers",
    icon: "book-user",
    group: "contacts",
    ready: true,
  },
  { id: "people", label: "People", icon: "users", group: "team", ready: false },
  { id: "time", label: "Time", icon: "clock", group: "team", ready: false },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    group: "admin",
    ready: false,
  },
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

/** Visible sections under their sidebar headings, empty groups dropped. */
export function groupSections(
  sections: readonly Section[],
): { id: GroupId; label: string; sections: Section[] }[] {
  return GROUPS.map((group) => ({
    ...group,
    sections: sections.filter((section) => section.group === group.id),
  })).filter((group) => group.sections.length > 0);
}
