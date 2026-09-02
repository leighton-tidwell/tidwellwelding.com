import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import Checkbox from "@/components/ds/checkbox";
import Radio from "@/components/ds/radio";
import Switch from "@/components/ds/switch";

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

describe("Radio", () => {
  test("clicking selects and onChange receives this radio's value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Radio label="Shop" name="where" value="shop" onChange={onChange} />,
    );
    const radio = screen.getByRole("radio", { name: "Shop" });
    await user.click(radio);
    expect(radio).toBeChecked();
    expect(onChange).toHaveBeenCalledWith("shop", expect.anything());
  });

  test("two radios in a group switch selection", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Radio label="Shop" name="where" value="shop" defaultChecked />
        <Radio label="Field" name="where" value="field" />
      </form>,
    );
    const shop = screen.getByRole("radio", { name: "Shop" });
    const field = screen.getByRole("radio", { name: "Field" });
    expect(shop).toBeChecked();
    await user.click(field);
    expect(field).toBeChecked();
    expect(shop).not.toBeChecked();
  });
});

describe("Switch", () => {
  test("renders role switch and toggles the On/Off state text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Switch label="Live" onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Live" });
    expect(sw).not.toBeChecked();
    expect(container.querySelector(".tsws-switch__state")).toHaveTextContent(
      "Off",
    );

    await user.click(sw);
    expect(sw).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(container.querySelector(".tsws-switch")).toHaveClass(
      "tsws-switch--on",
    );
    expect(container.querySelector(".tsws-switch__state")).toHaveTextContent(
      "On",
    );

    await user.click(sw);
    expect(sw).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  test("showState={false} hides the state text", () => {
    const { container } = render(<Switch label="Quiet" showState={false} />);
    expect(container.querySelector(".tsws-switch__state")).toBeNull();
  });

  test("disabled blocks toggling", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Locked" disabled onChange={onChange} />);
    await user.click(screen.getByRole("switch", { name: "Locked" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
