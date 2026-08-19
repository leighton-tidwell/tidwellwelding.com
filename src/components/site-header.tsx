"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { BadgeImg } from "@/components/badge-img";
import Badge from "@/components/ds/badge";
import Button from "@/components/ds/button";
import HazardBar from "@/components/ds/hazard-bar";
import Icon from "@/components/ds/icon";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/business";

const NAV_LINKS = [
  { id: "home", href: "/", label: "Home" },
  { id: "services", href: "/services", label: "Services" },
  { id: "work", href: "/work", label: "Work" },
  { id: "about", href: "/about", label: "About" },
  { id: "contact", href: "/contact", label: "Contact" },
] as const;

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  // Close the sheet when the route changes (render-time adjustment).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header
      className={open ? "site-header site-header--open" : "site-header"}
      onKeyDown={(e) => {
        // Escape closes the menu sheet and hands focus back to the toggle.
        if (e.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <HazardBar variant="red" height="4px" />
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand" aria-label="Tidwell Specialty Welding home">
          <BadgeImg
            src="/logo-badge.png"
            alt="Tidwell Specialty Welding badge"
            className="site-header__logo"
          />
          <span className="site-header__wordmark">
            Tidwell
            <br />
            Specialty Welding
          </span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <ul
            role="list"
            style={{ display: "contents", listStyle: "none", margin: 0, padding: 0 }}
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href, pathname);
              return (
                <li key={link.id} role="listitem" style={{ display: "contents" }}>
                  <Link
                    href={link.href}
                    className={
                      active ? "site-nav__link site-nav__link--active" : "site-nav__link"
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                    <span className="site-nav__seam" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="site-header__end">
          <span className="site-header__badge">
            <Badge variant="danger" dot live>
              24/7 Emergency
            </Badge>
          </span>
          <a
            href={PHONE_TEL}
            className="site-header__phone"
            style={{ padding: "12px 0" }}
          >
            {PHONE_DISPLAY}
          </a>
          <span className="site-header__quote">
            <Button variant="primary" size="sm" href="/quote">
              Request a quote
            </Button>
          </span>
          <button
            ref={toggleRef}
            type="button"
            className="site-header__toggle tsws-iconbtn tsws-iconbtn--ghost tsws-iconbtn--md"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>
      <div className="site-sheet" id="site-menu">
        <div className="site-sheet__panel">
          <nav aria-label="Site" style={{ display: "flex", flexDirection: "column" }}>
            <ul
              role="list"
              style={{ display: "contents", listStyle: "none", margin: 0, padding: 0 }}
            >
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href, pathname);
                return (
                  <li key={link.id} role="listitem" style={{ display: "contents" }}>
                    <Link
                      href={link.href}
                      className={
                        active
                          ? "site-sheet__link site-sheet__link--active"
                          : "site-sheet__link"
                      }
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="site-sheet__cta">
            <a href={PHONE_TEL} className="site-sheet__phone">
              <Icon name="phone" size={16} />
              {PHONE_DISPLAY}
            </a>
            <Button variant="primary" size="md" href="/quote" block>
              Request a quote
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export { SiteHeader };
