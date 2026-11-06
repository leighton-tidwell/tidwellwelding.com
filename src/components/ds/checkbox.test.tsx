import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import Checkbox from "@/components/ds/checkbox";

afterEach(cleanup);

describe("Checkbox", () => {
  test("uncontrolled: clicking toggles checked state and class", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <Checkbox label="Insured" onChange={onChange} />,
    );
    const box = screen.getByRole("checkbox", { name: "Insured" });
    expect(box).not.toBeChecked();
    expect(container.querySelector(".tsws-check--checked")).toBeNull();

    await user.click(box);
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(container.querySelector(".tsws-check--checked")).not.toBeNull();

    await user.click(box);
    expect(box).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  test("defaultChecked starts checked", () => {
    render(<Checkbox label="On" defaultChecked />);
    expect(screen.getByRole("checkbox", { name: "On" })).toBeChecked();
  });

  test("controlled: reports the change but state follows the prop", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Ctl" checked={false} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Ctl" });
    await user.click(box);
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
    expect(box).not.toBeChecked();
  });

  test("disabled blocks toggling", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Off limits" disabled onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Off limits" });
    await user.click(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(box).not.toBeChecked();
  });
});
