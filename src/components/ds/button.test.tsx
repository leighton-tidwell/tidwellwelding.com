import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Button from "@/components/ds/button";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} data-nextlink="true" {...rest}>
      {children}
    </a>
  ),
}));

describe("Button", () => {
  test("renders a button with base + primary + md classes by default", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn).toHaveClass("tsws-btn", "tsws-btn--primary", "tsws-btn--md");
    expect(btn).toHaveAttribute("type", "button");
  });

  test.each(["primary", "secondary", "ghost", "quiet"] as const)(
    "variant %s renders its modifier class",
    (variant) => {
      render(<Button variant={variant}>V</Button>);
      expect(screen.getByRole("button", { name: "V" })).toHaveClass(
        `tsws-btn--${variant}`,
      );
    },
  );

  test.each(["sm", "md", "lg"] as const)(
    "size %s renders its modifier class",
    (size) => {
      render(<Button size={size}>S</Button>);
      expect(screen.getByRole("button", { name: "S" })).toHaveClass(
        `tsws-btn--${size}`,
      );
    },
  );

  test("block prop adds the block class", () => {
    render(<Button block>B</Button>);
    expect(screen.getByRole("button", { name: "B" })).toHaveClass(
      "tsws-btn--block",
    );
  });

  test("internal href renders a Link-backed anchor", () => {
    render(<Button href="/quote">Request a quote</Button>);
    const link = screen.getByRole("link", { name: "Request a quote" });
    expect(link).toHaveAttribute("href", "/quote");
    expect(link).toHaveAttribute("data-nextlink", "true");
    expect(link).toHaveClass("tsws-btn", "tsws-btn--primary");
  });

  test("hash href is treated as internal", () => {
    render(<Button href="#top">Top</Button>);
    expect(screen.getByRole("link", { name: "Top" })).toHaveAttribute(
      "data-nextlink",
      "true",
    );
  });

  test("tel: href renders a plain anchor, not a Link", () => {
    render(<Button href="tel:8178946357">Call</Button>);
    const link = screen.getByRole("link", { name: "Call" });
    expect(link).toHaveAttribute("href", "tel:8178946357");
    expect(link).not.toHaveAttribute("data-nextlink");
  });

  test("external href with target _blank gets rel noopener by default", () => {
    render(
      <Button href="https://example.com" target="_blank">
        Out
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Out" });
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("explicit rel wins over the default", () => {
    render(
      <Button href="https://example.com" target="_blank" rel="noreferrer">
        Out
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Out" })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
  });

  test("disabled renders a disabled button even when href is set", () => {
    render(
      <Button href="/quote" disabled>
        Nope
      </Button>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });

  test("disabled blocks onClick", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("enabled button fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Yes</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("iconLeft/iconRight render around the label", () => {
    render(
      <Button
        iconLeft={<span data-testid="left" />}
        iconRight={<span data-testid="right" />}
      >
        Mid
      </Button>,
    );
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
    expect(screen.getByText("Mid")).toHaveClass("tsws-btn__label");
  });

  test("ariaBusy marks a button whose action is still running", () => {
    render(<Button ariaBusy>Building</Button>);
    expect(screen.getByRole("button", { name: "Building" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  test("a button that is not busy says so rather than omitting the state", () => {
    render(<Button ariaBusy={false}>Idle</Button>);
    expect(screen.getByRole("button", { name: "Idle" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  test("aria-busy is absent entirely when the caller does not manage it", () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole("button", { name: "Plain" })).not.toHaveAttribute(
      "aria-busy",
    );
  });
});
