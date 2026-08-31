import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

// This project runs vitest with globals disabled, so RTL's automatic cleanup
// never registers. Without this, renders stack up across tests in one document
// and every getAllBy* query sees the previous test's rows too.
afterEach(cleanup);
import LineItemEditor, { type EditorLine } from "./line-item-editor";

const LINE = (over: Partial<EditorLine> = {}): EditorLine => ({
  key: "k1",
  qty: "1",
  unit: "ea",
  description: "Ranch gate",
  rate: "1000",
  taxable: true,
  ...over,
});

function setup(lines: EditorLine[], props: Partial<React.ComponentProps<typeof LineItemEditor>> = {}) {
  const onChange = vi.fn();
  const view = render(
    <LineItemEditor
      lines={lines}
      onChange={onChange}
      laborRate={175}
      {...props}
    />,
  );
  const lastChange = () => onChange.mock.calls.at(-1)![0] as EditorLine[];
  return { onChange, lastChange, view, user: userEvent.setup() };
}

/** Query inside one line's group so a multi-row form is never ambiguous. */
function row(index: number) {
  return within(screen.getAllByRole("group", { name: /line item/i })[index]);
}

describe("LineItemEditor — adding and removing work", () => {
  test("adding a line appends an empty row rather than duplicating the last", async () => {
    const { lastChange, user } = setup([LINE()]);

    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(lastChange()).toHaveLength(2);
    expect(lastChange()[1].description).toBe("");
    expect(lastChange()[1].rate).toBe("");
  });

  test("removing a line drops the one that was clicked, not the last one", async () => {
    const lines = [
      LINE({ key: "a", description: "First" }),
      LINE({ key: "b", description: "Second" }),
      LINE({ key: "c", description: "Third" }),
    ];
    const { lastChange, user } = setup(lines);

    await user.click(row(1).getByRole("button", { name: /remove/i }));

    expect(lastChange().map((l) => l.description)).toEqual(["First", "Third"]);
  });

  test("the last remaining line cannot be removed, so the invoice is never empty", () => {
    setup([LINE()]);
    expect(row(0).getByRole("button", { name: /remove/i })).toBeDisabled();
  });
});

describe("LineItemEditor — the hourly rate prefill", () => {
  test("choosing hours fills in the configured shop rate", async () => {
    const { lastChange, user } = setup([LINE({ unit: "ea", rate: "" })]);

    await user.selectOptions(row(0).getByLabelText(/unit/i), "hr");

    expect(lastChange()[0].unit).toBe("hr");
    expect(lastChange()[0].rate).toBe("175");
  });

  test("choosing hours never overwrites a rate already typed", async () => {
    const { lastChange, user } = setup([LINE({ unit: "ea", rate: "250" })]);

    await user.selectOptions(row(0).getByLabelText(/unit/i), "hr");

    expect(lastChange()[0].rate).toBe("250");
  });

  test("a rate agreed for this job carries to the next hourly line", async () => {
    // Eric negotiated $200/hr on this job; the second labour line should
    // follow what he just typed, not the shop default.
    const { lastChange, user } = setup([
      LINE({ key: "a", unit: "hr", rate: "200" }),
      LINE({ key: "b", unit: "ea", rate: "" }),
    ]);

    await user.selectOptions(row(1).getByLabelText(/unit/i), "hr");

    expect(lastChange()[1].rate).toBe("200");
  });

  test("with no configured rate, choosing hours leaves the field empty", async () => {
    const { lastChange, user } = setup([LINE({ unit: "ea", rate: "" })], {
      laborRate: null,
    });

    await user.selectOptions(row(0).getByLabelText(/unit/i), "hr");

    expect(lastChange()[0].rate).toBe("");
  });
});

describe("LineItemEditor — the tax toggle", () => {
  test("each line's taxable flag can be turned off independently", async () => {
    const lines = [LINE({ key: "a" }), LINE({ key: "b" })];
    const { lastChange, user } = setup(lines);

    await user.click(row(0).getByRole("checkbox", { name: /tax/i }));

    expect(lastChange()[0].taxable).toBe(false);
    expect(lastChange()[1].taxable).toBe(true);
  });
});

describe("LineItemEditor — what the line is worth", () => {
  test("shows the computed amount for each line as it is typed", () => {
    setup([LINE({ qty: "25", unit: "hr", rate: "175" })]);
    expect(row(0).getByText("$4,375.00")).toBeInTheDocument();
  });

  test("an unparseable rate shows no amount instead of NaN", () => {
    setup([LINE({ qty: "1", rate: "abc" })]);
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(row(0).getByText("—")).toBeInTheDocument();
  });

  test("a part-hour quantity computes correctly", () => {
    setup([LINE({ qty: "1.5", unit: "hr", rate: "175" })]);
    expect(row(0).getByText("$262.50")).toBeInTheDocument();
  });
});

describe("LineItemEditor — built for a phone", () => {
  test("number fields ask for the numeric keypad", () => {
    setup([LINE()]);
    expect(row(0).getByLabelText(/qty/i)).toHaveAttribute("inputMode", "decimal");
    expect(row(0).getByLabelText(/rate/i)).toHaveAttribute("inputMode", "decimal");
  });

  test("every line is a labelled group so screen readers can navigate rows", () => {
    setup([LINE({ key: "a" }), LINE({ key: "b" })]);
    const rows = screen.getAllByRole("group", { name: /line item/i });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName("Line item 1");
    expect(rows[1]).toHaveAccessibleName("Line item 2");
  });
});
