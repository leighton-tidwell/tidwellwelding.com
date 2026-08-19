import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SiteHeader from "@/components/site-header";

afterEach(cleanup);

const NAV = [
  ["Home", "/"],
  ["Services", "/services"],
  ["Work", "/work"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

describe("SiteHeader", () => {
  beforeEach(() => {
    nav.pathname = "/";
  });

  test("renders all nav links with their hrefs in the desktop nav", () => {
    const { container } = render(<SiteHeader />);
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(".site-nav__link"),
    );
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual(
      NAV.map(([label, href]) => [label, href]),
    );
  });

  test("active link for the current path carries the seam styling", () => {
    nav.pathname = "/services";
    const { container } = render(<SiteHeader />);
    const active = container.querySelectorAll(".site-nav__link--active");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Services");
    expect(active[0]).toHaveAttribute("aria-current", "page");
    expect(active[0].querySelector(".site-nav__seam")).toBeInTheDocument();
  });

  test("nested paths keep the section link active", () => {
    nav.pathname = "/services/pipe";
    const { container } = render(<SiteHeader />);
    const active = container.querySelector(".site-nav__link--active");
    expect(active).toHaveTextContent("Services");
  });

  test("home is only active on exactly /", () => {
    nav.pathname = "/about";
    const { container } = render(<SiteHeader />);
    const active = container.querySelector(".site-nav__link--active");
    expect(active).toHaveTextContent("About");
    const home = Array.from(
      container.querySelectorAll(".site-nav__link"),
    ).find((l) => l.textContent === "Home");
    expect(home).not.toHaveClass("site-nav__link--active");
  });

  test("hamburger opens the mobile sheet", () => {
    const { container } = render(<SiteHeader />);
    const header = container.querySelector(".site-header");
    expect(header).not.toHaveClass("site-header--open");

    const toggle = screen.getByRole("button", { name: "Open the menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(header).toHaveClass("site-header--open");
    const close = screen.getByRole("button", { name: "Close the menu" });
    expect(close).toHaveAttribute("aria-expanded", "true");
    expect(close).toHaveAttribute("aria-controls", "site-menu");

    fireEvent.click(close);
    expect(header).not.toHaveClass("site-header--open");
  });

  test("Escape closes the sheet and refocuses the toggle", () => {
    const { container } = render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Open the menu" }));
    const header = container.querySelector(".site-header") as HTMLElement;
    expect(header).toHaveClass("site-header--open");

    fireEvent.keyDown(header, { key: "Escape" });
    expect(header).not.toHaveClass("site-header--open");
    expect(screen.getByRole("button", { name: "Open the menu" })).toHaveFocus();
  });

  test("clicking a sheet link closes the sheet", () => {
    const { container } = render(<SiteHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Open the menu" }));
    const sheetLink = container.querySelector(".site-sheet__link");
    fireEvent.click(sheetLink as Element);
    expect(container.querySelector(".site-header")).not.toHaveClass(
      "site-header--open",
    );
  });

  test("tel link is present", () => {
    const { container } = render(<SiteHeader />);
    const tel = container.querySelectorAll('a[href="tel:8178946357"]');
    expect(tel.length).toBeGreaterThanOrEqual(1);
    expect(tel[0]).toHaveTextContent("(817) 894-6357");
  });

  test("quote CTA links to /quote", () => {
    const { container } = render(<SiteHeader />);
    expect(
      container.querySelector('.site-header__quote a[href="/quote"]'),
    ).toBeInTheDocument();
  });

  test("crew console is not linked from the public header", () => {
    const { container } = render(<SiteHeader />);
    // Check the sheet too (its links exist in the DOM even when closed).
    const crewHrefs = Array.from(container.querySelectorAll("a")).filter((a) =>
      (a.getAttribute("href") ?? "").startsWith("/crew"),
    );
    expect(crewHrefs).toHaveLength(0);
  });
});
