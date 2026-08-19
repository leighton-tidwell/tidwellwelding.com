import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import Tabs, { type TabItem } from "@/components/ds/tabs";

afterEach(cleanup);

beforeAll(() => {
  // Tabs uses CSS.escape for the seam position lookup.
  if (typeof window.CSS === "undefined" || typeof window.CSS.escape !== "function") {
    Object.defineProperty(window, "CSS", {
      writable: true,
      value: {
        escape: (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`),
      },
    });
  }
});

const ITEMS: TabItem[] = [
  { id: "all", label: "All", count: 12, content: <div>All jobs</div> },
  { id: "pipe", label: "Pipe", content: <div>Pipe jobs</div> },
  { id: "rail", label: "Rail", content: <div>Rail jobs</div> },
];

describe("Tabs", () => {
  test("renders a tablist with all tabs; first tab active by default", () => {
    render(<Tabs items={ITEMS} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Pipe" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("All jobs");
  });

  test("defaultValue selects that tab", () => {
    render(<Tabs items={ITEMS} defaultValue="pipe" />);
    expect(screen.getByRole("tab", { name: "Pipe" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pipe jobs");
  });

  test("clicking a tab switches the panel and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Rail" }));
    expect(onChange).toHaveBeenCalledWith("rail");
    expect(screen.getByRole("tab", { name: "Rail" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rail jobs");
    expect(screen.queryByText("All jobs")).not.toBeInTheDocument();
  });

  test("controlled value wins; clicks report but do not switch on their own", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} value="pipe" onChange={onChange} />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pipe jobs");
    await user.click(screen.getByRole("tab", { name: "Rail" }));
    expect(onChange).toHaveBeenCalledWith("rail");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pipe jobs");
  });

  test("count renders in the tab", () => {
    const { container } = render(<Tabs items={ITEMS} />);
    expect(container.querySelector(".tsws-tabs__tab-count")).toHaveTextContent(
      "12",
    );
  });

  test("roving tabindex: only the active tab is in the tab order", () => {
    render(<Tabs items={ITEMS} defaultValue="pipe" />);
    expect(screen.getByRole("tab", { name: "Pipe" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("tab", { name: "Rail" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  test("arrow keys move focus and selection, wrapping; Home/End jump", async () => {
    const user = userEvent.setup();
    render(<Tabs items={ITEMS} />);

    screen.getByRole("tab", { name: /All/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Pipe" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Pipe" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pipe jobs");

    // Wraps backwards from the first tab.
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Rail" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Rail jobs");

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /All/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Rail" })).toHaveFocus();
  });

  test("tab and panel ids are unique across instances", () => {
    render(
      <>
        <Tabs items={ITEMS} />
        <Tabs items={ITEMS} />
      </>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Each tab still labels its panel.
    for (const panel of screen.getAllByRole("tabpanel")) {
      const labelledBy = panel.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy as string)).toHaveAttribute(
        "role",
        "tab",
      );
    }
  });

  test("bar-only items (no content) render no tabpanel", () => {
    render(
      <Tabs
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
      />,
    );
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
  });
});
