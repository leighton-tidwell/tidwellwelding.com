import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import FaqBot from "@/components/faq-bot";

/**
 * Shell for every public page. /admin lives OUTSIDE this group and gets
 * no header/footer/FaqBot. Pages should render sections, not <main> —
 * this layout owns the single <main> landmark.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* 2.4.1 Bypass Blocks: visually hidden until keyboard-focused. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <style>{`
        .skip-link{position:fixed;left:16px;top:16px;z-index:200;transform:translateY(calc(-100% - 24px));background:linear-gradient(180deg,var(--steel-700) 0%,var(--steel-800) 100%);border:1px solid var(--border-control);color:var(--white);font-family:var(--font-mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;padding:12px 18px}
        .skip-link:focus-visible{transform:none;outline:none;box-shadow:var(--focus-shadow)}
        #main:focus{outline:none;box-shadow:none}
      `}</style>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 flex flex-col">
        {children}
      </main>
      <SiteFooter />
      <FaqBot />
    </>
  );
}
