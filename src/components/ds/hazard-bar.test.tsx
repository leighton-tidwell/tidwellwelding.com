import { cleanup, render } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  test,
} from "vitest";
import HazardBar from "@/components/ds/hazard-bar";

afterEach(cleanup);

describe("HazardBar", () => {
  test("default renders the base amber bar, decorative", () => {
    const { container } = render(<HazardBar />);
    const bar = container.querySelector(".tsws-hazard");
    expect(bar).toBeInTheDocument();
    expect(bar?.className).toBe("tsws-hazard");
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  test.each(["red", "steel"] as const)(
    "variant %s renders its modifier class",
    (variant) => {
      const { container } = render(<HazardBar variant={variant} />);
      expect(container.querySelector(".tsws-hazard")).toHaveClass(
        `tsws-hazard--${variant}`,
      );
    },
  );

  test("amber variant adds no modifier class", () => {
    const { container } = render(<HazardBar variant="amber" />);
    expect(container.querySelector(".tsws-hazard")?.className).toBe(
      "tsws-hazard",
    );
  });

  test("animated adds the animation class", () => {
    const { container } = render(<HazardBar animated />);
    expect(container.querySelector(".tsws-hazard")).toHaveClass(
      "tsws-hazard--animated",
    );
  });

  test("height prop lands in inline style", () => {
    const { container } = render(<HazardBar height="4px" />);
    expect(container.querySelector(".tsws-hazard")).toHaveStyle({
      height: "4px",
    });
  });
});
