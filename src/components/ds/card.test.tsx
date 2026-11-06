import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import Card from "@/components/ds/card";

afterEach(cleanup);

describe("Card", () => {
  test("renders eyebrow and title", () => {
    render(<Card eyebrow="THE SHOP" title="Fabrication" />);
    const eyebrow = screen.getByText("THE SHOP");
    const title = screen.getByText("Fabrication");
    expect(eyebrow).toHaveClass("tsws-card__eyebrow");
    expect(title).toHaveClass("tsws-card__title");
  });

  test("renders the red top rule by default", () => {
    const { container } = render(<Card title="T" />);
    expect(container.querySelector(".tsws-card__rule")).toBeInTheDocument();
  });

  test("rule={false} removes the top rule", () => {
    const { container } = render(<Card title="T" rule={false} />);
    expect(container.querySelector(".tsws-card__rule")).not.toBeInTheDocument();
  });

  test("interactive adds the interactive class", () => {
    const { container } = render(<Card interactive title="Clickable" />);
    expect(container.querySelector(".tsws-card")).toHaveClass(
      "tsws-card--interactive",
    );
  });

  test.each(["plate", "light"] as const)(
    "variant %s renders its modifier class",
    (variant) => {
      const { container } = render(<Card variant={variant} />);
      expect(container.querySelector(".tsws-card")).toHaveClass(
        `tsws-card--${variant}`,
      );
    },
  );

  test("string children are wrapped in the body paragraph", () => {
    render(<Card>Plain body copy</Card>);
    const p = screen.getByText("Plain body copy");
    expect(p.tagName).toBe("P");
    expect(p).toHaveClass("tsws-card__text");
  });

  test("node children render as-is", () => {
    render(
      <Card>
        <div data-testid="custom-body">custom</div>
      </Card>,
    );
    expect(screen.getByTestId("custom-body")).toBeInTheDocument();
  });

  test("media and footer slots render in their wrappers", () => {
    const { container } = render(
      <Card
        media={<img alt="weld" src="/x.jpg" />}
        footer={<span>foot</span>}
      />,
    );
    expect(
      container.querySelector(".tsws-card__media img"),
    ).toBeInTheDocument();
    expect(container.querySelector(".tsws-card__footer")).toHaveTextContent(
      "foot",
    );
  });
});
