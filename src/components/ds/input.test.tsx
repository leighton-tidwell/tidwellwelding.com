import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import Input from "@/components/ds/input";

afterEach(cleanup);

describe("Input", () => {
  test("label is associated with the input", () => {
    render(<Input label="Phone" />);
    const input = screen.getByLabelText("Phone");
    expect(input.tagName).toBe("INPUT");
  });

  test("required renders the * marker inside the label", () => {
    const { container } = render(<Input label="Name" required />);
    const req = container.querySelector(".tsws-field__req");
    expect(req).toHaveTextContent("*");
    expect(screen.getByLabelText(/^Name/)).toBeRequired();
  });

  test("no required marker without the prop", () => {
    const { container } = render(<Input label="Company" />);
    expect(container.querySelector(".tsws-field__req")).not.toBeInTheDocument();
  });

  test("hint renders and is wired via aria-describedby", () => {
    render(<Input label="Dims" hint="Sizes and counts" />);
    const input = screen.getByLabelText("Dims");
    const hint = screen.getByText("Sizes and counts");
    expect(hint).toHaveClass("tsws-field__hint");
    expect(input).toHaveAttribute("aria-describedby", hint.id);
  });

  test("error replaces the hint, sets aria-invalid and describedby", () => {
    render(<Input label="Phone" hint="10 digits" error="Enter a 10-digit number." />);
    const input = screen.getByLabelText("Phone");
    const error = screen.getByText("Enter a 10-digit number.");
    expect(error).toHaveClass("tsws-field__error");
    expect(screen.queryByText("10 digits")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  });

  test("error is announced as an alert for screen readers", () => {
    render(<Input label="Phone" error="Enter a 10-digit number." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a 10-digit number.",
    );
  });

  test("error adds the control error class", () => {
    const { container } = render(<Input label="X" error="Bad" />);
    expect(container.querySelector(".tsws-control")).toHaveClass(
      "tsws-control--error",
    );
  });

  test("multiline renders a textarea with rows", () => {
    render(<Input label="Description" multiline rows={6} />);
    const field = screen.getByLabelText("Description");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("rows", "6");
  });

  test("adornment renders inside the plate", () => {
    const { container } = render(<Input label="Quote" adornment="$" />);
    const adorn = container.querySelector(".tsws-control__adorn");
    expect(adorn).toHaveTextContent("$");
    expect(adorn).toHaveAttribute("aria-hidden", "true");
  });

  test("onChange receives the string value first", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} defaultValue="" />);
    await user.type(screen.getByLabelText("Name"), "Ed");
    expect(onChange).toHaveBeenLastCalledWith("Ed", expect.anything());
  });

  test("disabled input renders disabled with the disabled control class", () => {
    const { container } = render(<Input label="Locked" disabled />);
    expect(screen.getByLabelText("Locked")).toBeDisabled();
    expect(container.querySelector(".tsws-control")).toHaveClass(
      "tsws-control--disabled",
    );
  });
});
