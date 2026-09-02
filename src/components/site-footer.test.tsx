import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

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

import SiteFooter from "@/components/site-footer";

afterEach(cleanup);

const ALLOWED_HREF_PREFIXES = [
  "/services",
  "/welder/",
  "/search",
  "/work",
  "/about",
  "/contact",
  "/quote",
  "tel:",
  "mailto:",
  "https://www.tiktok.com/",
  "https://www.facebook.com/",
  // Designer credit in the bottom bar.
  "https://www.tdwl.dev/",
];

const EXPECTED_SERVICE_LINKS: Array<[string, string]> = [
  ["Fabrication", "/services/fabrication"],
  ["Staircases & handrail", "/services/structural"],
  ["Pipe welding", "/services/pipe"],
  ["Heavy equipment repair", "/services/equipment"],
  ["Mobile welding", "/services/mobile"],
  ["Emergency & on-call", "/services/emergency"],
];

const EXPECTED_SERVICE_AREA_LINKS: Array<[string, string]> = [
  ["Welder in Granbury, TX", "/welder/granbury-tx"],
  ["Welder in Fort Worth, TX", "/welder/fort-worth-tx"],
  ["Welder in Stephenville, TX", "/welder/stephenville-tx"],
];

describe("SiteFooter", () => {
  test("legal line names the LLC", () => {
    render(<SiteFooter />);
    expect(
      screen.getByText(/Tidwell Specialty Welding Services, LLC/),
    ).toBeInTheDocument();
  });

  test("admin console is not linked from the public footer", () => {
    const { container } = render(<SiteFooter />);
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
    const crewHrefs = Array.from(container.querySelectorAll("a")).filter((a) =>
      (a.getAttribute("href") ?? "").startsWith("/admin"),
    );
    expect(crewHrefs).toHaveLength(0);
  });

  test("does not link to any seo page", () => {
    const { container } = render(<SiteFooter />);
    const hrefs = Array.from(container.querySelectorAll("a")).map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.toLowerCase()).not.toContain("seo");
      expect(
        ALLOWED_HREF_PREFIXES.some((prefix) => href.startsWith(prefix)),
        `unexpected footer link: ${href}`,
      ).toBe(true);
    }
  });

  test("service links point at the dedicated service routes", () => {
    render(<SiteFooter />);
    for (const [label, href] of EXPECTED_SERVICE_LINKS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("no footer link uses a hash anchor", () => {
    const { container } = render(<SiteFooter />);
    const anchored = Array.from(container.querySelectorAll("a")).filter((a) =>
      (a.getAttribute("href") ?? "").includes("#"),
    );
    expect(anchored).toHaveLength(0);
  });

  test("service areas column links all three town pages", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("navigation", { name: "Service areas" }),
    ).toBeInTheDocument();
    for (const [label, href] of EXPECTED_SERVICE_AREA_LINKS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  test("company column links the search page", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/search",
    );
  });

  test("contact details render", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "(817) 894-6357" }),
    ).toHaveAttribute("href", "tel:8178946357");
    expect(
      screen.getByRole("link", { name: "eric@tidwellwelding.com" }),
    ).toHaveAttribute("href", "mailto:eric@tidwellwelding.com");
  });
});
