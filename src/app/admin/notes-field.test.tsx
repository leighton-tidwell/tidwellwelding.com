import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import NotesField from "./notes-field";

// Globals are off, so RTL's automatic cleanup never registers.
afterEach(cleanup);

// Two 100pt lines of 8pt Helvetica: twelve capital Ws to a line.
const BOX = { lines: 2, width: 100 };

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NotesField label="Notes" box={BOX} value={value} onChange={setValue} />
  );
}

describe("NotesField", () => {
  test("counts printed lines as the note wraps", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("0 of 2 printed lines used")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Notes"), "W".repeat(13));

    expect(
      screen.getByText("On the last of 2 printed lines"),
    ).toBeInTheDocument();
  });

  test("stops taking text once the last printed line is full", async () => {
    const user = userEvent.setup();
    render(<Harness initial={"W".repeat(23)} />);
    const field = screen.getByLabelText("Notes");

    await user.type(field, "WWW");

    expect(field).toHaveValue("W".repeat(24));
  });

  test("drops characters the PDF cannot print", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText("Notes");

    await user.click(field);
    await user.paste("Peña ½ in. 👍 ✔");

    expect(field).toHaveValue("Peña ½ in.  ");
  });

  test("keeps the part of a pasted note that fits", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText("Notes");

    await user.click(field);
    await user.paste("one\ntwo\nthree");

    expect(field).toHaveValue("one\ntwo");
  });
});
