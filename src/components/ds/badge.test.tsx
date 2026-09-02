import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Badge } from "@/components/ds";

afterEach(cleanup);

describe("Badge", () => {
  test("renders its text", () => {
    render(<Badge variant="ok">Certified</Badge>);
    expect(screen.getByText("Certified")).toBeInTheDocument();
  });

  test("default variant renders no modifier class", () => {
    render(<Badge>Plain</Badge>);
    const badge = screen.getByText("Plain");
    expect(badge).toHaveClass("tsws-badge");
    expect(badge.className).toBe("tsws-badge");
  });

  test.each(["accent", "solid", "ok", "warn", "danger", "idle"] as const)(
    "variant %s renders its modifier class",
    (variant) => {
      render(<Badge variant={variant}>V</Badge>);
      expect(screen.getByText("V")).toHaveClass(`tsws-badge--${variant}`);
    },
  );

  test("dot renders the status dot", () => {
    const { container } = render(<Badge dot>With dot</Badge>);
    const dot = container.querySelector(".tsws-badge__dot");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  test("no dot by default", () => {
    const { container } = render(<Badge>No dot</Badge>);
    expect(container.querySelector(".tsws-badge__dot")).not.toBeInTheDocument();
  });

  test("live adds the live modifier", () => {
    render(
      <Badge variant="danger" dot live>
        24/7 Emergency
      </Badge>,
    );
    expect(screen.getByText("24/7 Emergency")).toHaveClass("tsws-badge--live");
  });
});
