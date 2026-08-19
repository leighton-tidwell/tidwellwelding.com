import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import Select from "@/components/ds/select";

afterEach(cleanup);

const OPTIONS = ["Carbon steel", "Stainless", "Aluminum"];

describe("Select", () => {
  test("renders all string options", () => {
    render(<Select label="Material" options={OPTIONS} />);
    for (const label of OPTIONS) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  test("object options render label with value", () => {
    render(
      <Select
        label="Timeline"
        options={[{ value: "asap", label: "Right now" }]}
      />,
    );
    const option = screen.getByRole("option", { name: "Right now" });
    expect(option).toHaveValue("asap");
  });

  test("placeholder renders as a disabled empty first option and is preselected", () => {
    render(<Select label="Material" options={OPTIONS} placeholder="Pick one" />);
    const placeholder = screen.getByRole("option", { name: "Pick one" });
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveValue("");
    const select = screen.getByLabelText("Material") as HTMLSelectElement;
    expect(select.options[0]).toBe(placeholder);
    expect(select).toHaveValue("");
  });

  test("onChange receives the selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        label="Material"
        options={OPTIONS}
        placeholder="Pick one"
        onChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Material"), "Stainless");
    expect(onChange).toHaveBeenCalledWith("Stainless", expect.anything());
  });

  test("error renders and marks the select invalid", () => {
    render(
      <Select label="Job type" options={OPTIONS} error="Pick a job type." />,
    );
    expect(screen.getByText("Pick a job type.")).toHaveClass(
      "tsws-field__error",
    );
    expect(screen.getByLabelText("Job type")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("error is announced as an alert for screen readers", () => {
    render(
      <Select label="Job type" options={OPTIONS} error="Pick a job type." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a job type.");
  });

  test("required renders the * marker", () => {
    const { container } = render(
      <Select label="Job type" options={OPTIONS} required />,
    );
    expect(container.querySelector(".tsws-field__req")).toHaveTextContent("*");
  });
});
