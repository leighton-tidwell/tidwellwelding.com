import { describe, expect, it } from "vitest";
import { groupSections, type Section, visibleSections } from "./nav";

describe("visibleSections", () => {
  it("never shows a reserved section, even to someone allowed everything", () => {
    const labels = visibleSections(() => true).map((s) => s.label);
    expect(labels).not.toContain("Jobs");
    expect(labels).not.toContain("Time");
  });

  it("hides a built section whose permission the user lacks", () => {
    const sections: Section[] = [
      { id: "jobs", label: "Jobs", icon: "wrench", group: "work", ready: true },
      {
        id: "time",
        label: "Time",
        icon: "clock",
        group: "team",
        ready: true,
        permission: "time.approve",
      },
      {
        id: "people",
        label: "People",
        icon: "users",
        group: "team",
        ready: true,
        permission: "people.manage",
      },
    ];
    const can = (permission: string) => permission === "time.approve";
    expect(visibleSections(can, sections).map((s) => s.label)).toEqual([
      "Jobs",
      "Time",
    ]);
  });
});

describe("groupSections", () => {
  it("drops a heading when none of its sections are visible", () => {
    const sections: Section[] = [
      { id: "jobs", label: "Jobs", icon: "wrench", group: "work", ready: true },
      { id: "time", label: "Time", icon: "clock", group: "team", ready: true },
    ];
    expect(groupSections(sections).map((g) => g.label)).toEqual([
      "Work",
      "Team",
    ]);
  });
});
