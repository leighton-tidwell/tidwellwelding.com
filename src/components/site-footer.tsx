import Link from "next/link";
import { BadgeImg } from "@/components/badge-img";
import HazardBar from "@/components/ds/hazard-bar";
import {
  EMAIL,
  EMAIL_MAILTO,
  FACEBOOK_URL,
  LEGAL_NAME,
  LOCALITY,
  PHONE_DISPLAY,
  PHONE_TEL,
  POSTAL_CODE,
  REGION,
  TIKTOK_URL,
} from "@/lib/business";

const SERVICE_LINKS = [
  { href: "/services/fabrication", label: "Fabrication" },
  { href: "/services/structural", label: "Staircases & handrail" },
  { href: "/services/pipe", label: "Pipe welding" },
  { href: "/services/equipment", label: "Heavy equipment repair" },
  { href: "/services/mobile", label: "Mobile welding" },
  { href: "/services/emergency", label: "Emergency & on-call" },
];

const SERVICE_AREA_LINKS = [
  { href: "/welder/granbury-tx", label: "Welder in Granbury, TX" },
  { href: "/welder/fort-worth-tx", label: "Welder in Fort Worth, TX" },
  { href: "/welder/stephenville-tx", label: "Welder in Stephenville, TX" },
];

const COMPANY_LINKS = [
  { href: "/work", label: "Job log" },
  { href: "/about", label: "About Eric" },
  { href: "/contact", label: "Contact & service area" },
  { href: "/quote", label: "Request a quote" },
  { href: "/search", label: "Search" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <HazardBar variant="amber" height="6px" />
      <div className="site-footer__grid">
        <div className="site-footer__col" style={{ gap: 16 }}>
          {/* Placeholder path — the real badge PNG lands in /public later. */}
          {}
          <BadgeImg
            src="/logo-badge.png"
            alt="TSWS badge"
            className="site-footer__logo"
          />
          <p className="site-footer__blurb">
            Welding and fabrication out of Granbury, Texas. Shop work when the
            part can come in. The truck when it can&apos;t.
          </p>
          <div className="site-footer__legal">{LEGAL_NAME} · Insured</div>
        </div>
        <div className="site-footer__col" style={{ gap: 24 }}>
          <nav className="site-footer__col" aria-label="Services">
            <div className="site-footer__heading">Services</div>
            <ul
              role="list"
              style={{
                display: "contents",
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {SERVICE_LINKS.map((l) => (
                <li
                  key={l.href}
                  role="listitem"
                  style={{ display: "contents" }}
                >
                  <Link href={l.href} className="site-footer__link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="site-footer__col" aria-label="Service areas">
            <div className="site-footer__heading">Service areas</div>
            <ul
              role="list"
              style={{
                display: "contents",
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {SERVICE_AREA_LINKS.map((l) => (
                <li
                  key={l.href}
                  role="listitem"
                  style={{ display: "contents" }}
                >
                  <Link href={l.href} className="site-footer__link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <nav className="site-footer__col" aria-label="Company">
          <div className="site-footer__heading">Company</div>
          <ul
            role="list"
            style={{
              display: "contents",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {COMPANY_LINKS.map((l) => (
              <li key={l.href} role="listitem" style={{ display: "contents" }}>
                <Link href={l.href} className="site-footer__link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-footer__col">
          <div className="site-footer__heading">Reach Eric</div>
          <a href={PHONE_TEL} className="site-footer__mono">
            {PHONE_DISPLAY}
          </a>
          <a
            href={EMAIL_MAILTO}
            className="site-footer__mono"
            style={{ letterSpacing: "0.06em", textTransform: "lowercase" }}
          >
            {EMAIL}
          </a>
          <div className="site-footer__towns">
            {/* Address line hides on phones: the towns line already says Granbury. */}
            <span className="site-footer__addr">
              {LOCALITY}, {REGION} {POSTAL_CODE}
              <br />
            </span>
            Granbury · Fort Worth · Stephenville
          </div>
          <div className="site-footer__oncall">
            On call 24/7 — nights, weekends, holidays
          </div>
          <div className="site-footer__chips">
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener"
              className="site-footer__chip"
            >
              TikTok · 10K
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener"
              className="site-footer__chip"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="site-footer__bottom-inner">
          <div className="site-footer__bottom-line">
            tidwellwelding.com · Welding since 2011
          </div>
          <div className="site-footer__bottom-line">
            Free quotes · We&apos;ll beat any quote you&apos;ve been given
          </div>
          <a
            className="site-footer__credit"
            href="https://www.tdwl.dev/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Site by TDWL Development"
          >
            <img src="/tdwl-logo.png" alt="" width={14} height={14} />
            <span>Site by TDWL</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };
