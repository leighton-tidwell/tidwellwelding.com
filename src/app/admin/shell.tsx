"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Icon } from "@/components/ds";
import { monogram } from "./monogram";
import { groupSections, type Section, type SectionId } from "./nav";

export { monogram };

/**
 * The console's frame. One nav element serves both layouts: from 900px up it
 * is a sidebar with the sections under group headings, and below that it is
 * a tab bar pinned to the bottom of the screen, under a top bar with the
 * workspace and sign-out. Rendering it once keeps every section a single
 * control for assistive tech and for the e2e suite.
 */
export function AdminShell({
  workspace,
  sections,
  current,
  onNavigate,
  onSignOut,
  screenKey,
  children,
}: {
  workspace: string;
  sections: readonly Section[];
  current: SectionId;
  onNavigate: (id: SectionId) => void;
  onSignOut: () => void;
  /** Changes whenever the screen does, so a failed screen recovers on
   * navigation rather than staying stuck on its error. */
  screenKey: string;
  children: ReactNode;
}) {
  return (
    <div className="adm adm-app">
      <header className="adm-side">
        <div className="adm-ws">
          <span className="adm-ws__mark" aria-hidden="true">
            {monogram(workspace)}
          </span>
          <span className="adm-ws__text">
            <span className="adm-ws__name">{workspace}</span>
            <span className="adm-ws__sub">Shop admin</span>
          </span>
        </div>
        <nav className="adm-nav" aria-label="Sections">
          {groupSections(sections).map((group) => (
            <div className="adm-nav__group" key={group.id}>
              <p className="adm-nav__heading" aria-hidden="true">
                {group.label}
              </p>
              <ul className="adm-nav__list">
                {group.sections.map((section) => {
                  const on = section.id === current;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className="adm-nav__item"
                        aria-current={on ? "page" : undefined}
                        onClick={() => onNavigate(section.id)}
                      >
                        <Icon
                          name={section.icon}
                          size={20}
                          strokeWidth={1.75}
                        />
                        <span className="adm-nav__label">{section.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="adm-signout"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          <Icon name="log-out" size={18} strokeWidth={1.75} />
          <span className="adm-signout__label">Sign out</span>
        </button>
      </header>
      <main className="adm-main">
        <ScreenBoundary key={screenKey}>{children}</ScreenBoundary>
      </main>
    </div>
  );
}

/** The figures a list opens with: what is owed, what is waiting. Each is a
 * big mono number over a short label; `tone` colours the one that needs
 * attention. */
export function StatStrip({
  stats,
}: {
  stats: { label: string; value: ReactNode; tone?: "accent" | "ok" }[];
}) {
  return (
    <dl className="adm-stats">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={stat.tone ? `adm-stat adm-stat--${stat.tone}` : "adm-stat"}
        >
          <dt className="adm-stat__label">{stat.label}</dt>
          <dd className="adm-stat__value">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Title row for every screen. A back link sits above it on detail screens,
 * and context (who the invoice is for, what kind of job) sits below it as a
 * plain meta line rather than as a label stacked on top. */
export function PageHeader({
  title,
  meta,
  back,
  aside,
}: {
  title: ReactNode;
  meta?: ReactNode;
  back?: { label: string; onClick: () => void };
  aside?: ReactNode;
}) {
  return (
    <div className="adm-head">
      {back ? (
        <button type="button" className="adm-back" onClick={back.onClick}>
          <Icon name="arrow-left" size={16} strokeWidth={1.75} />
          {back.label}
        </button>
      ) : null}
      <div className="adm-head__row">
        <div className="adm-head__text">
          <h1 className="admin-title">{title}</h1>
          {meta ? <p className="adm-head__meta">{meta}</p> : null}
        </div>
        {aside ? <div className="adm-head__aside">{aside}</div> : null}
      </div>
    </div>
  );
}

/** Placeholder rows while a query is in flight. Announced once to screen
 * readers; the bars themselves are decorative. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="adm-loading" role="status">
      <span className="admin-sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative bars that never reorder.
        <span key={i} className="adm-loading__bar" aria-hidden="true" />
      ))}
    </div>
  );
}

/** Nothing to show yet. Says what will appear here and, when there is one,
 * how to make the first. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="adm-empty">
      <p className="adm-empty__title">{title}</p>
      {children ? <div className="adm-empty__body">{children}</div> : null}
    </div>
  );
}

/** A screen that could not load. `onRetry` re-renders it from scratch. */
export function ErrorState({
  title,
  children,
  onRetry,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="adm-error" role="alert">
      <Icon name="circle-alert" size={20} strokeWidth={1.75} />
      <div className="adm-error__text">
        <p className="adm-empty__title">{title}</p>
        {children ? <div className="adm-empty__body">{children}</div> : null}
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A query that throws (a dropped connection, an expired session) used to take
 * the whole console down to a blank page. This keeps the nav on screen and
 * offers a retry instead.
 */
class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[admin] screen failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <ErrorState
          title="This screen didn't load"
          onRetry={() => this.setState({ failed: false })}
        >
          Check the connection, then try again. Signing out and back in clears
          an expired session.
        </ErrorState>
      );
    }
    return this.props.children;
  }
}

/** "1 invoice", "3 invoices": the count in a page header's meta line. */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** A record's status as a mark: a dot and a word. Invoice statuses are a fixed
 * set; quote statuses are free-form strings, which fall back to the neutral
 * mark. */
export function StatusMark({ status }: { status: string }) {
  return <span className={`adm-status adm-status--${status}`}>{status}</span>;
}
