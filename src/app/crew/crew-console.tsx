"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BadgeImg } from "@/components/badge-img";
import { Button, HazardBar, Input } from "@/components/ds";
import "./crew.css";

type Role = "Owner" | "Office" | "Crew welder";
type View = "inbox" | "jobs" | "schedule" | "invoices" | "customers";

type CrewUser = { name: string; role: Role };

type Quote = {
  id: string;
  title: string;
  who: string;
  phone: string;
  desc: string;
  meta: string;
  slot: string;
  status: string;
  custEst: string;
};

type Job = { code: string; title: string; meta: string; stage: number };

type Invoice = {
  id: string;
  job: string;
  customer: string;
  amount: string;
  paid: boolean;
};

type InternalBid = {
  bidLow: number;
  bidHigh: number;
  crew: number;
  hoursLow: number;
  hoursHigh: number;
  marginPct: number;
  note: string;
  risks: string[];
};

/** Shape /quote writes into localStorage under "tsws_quotes". */
type StoredQuote = {
  id?: string;
  status?: string;
  slot?: string;
  c?: { name?: string; company?: string; phone?: string };
  f?: { type?: string; material?: string; timeline?: string; desc?: string };
  est?: {
    title?: string;
    dollars_low?: number;
    dollars_high?: number;
    hours_low?: number;
    hours_high?: number;
  };
};

const USERS: CrewUser[] = [
  { name: "Eric Tidwell", role: "Owner" },
  { name: "Paige Tidwell", role: "Office" },
  { name: "J. Reyes", role: "Crew welder" },
];

const ALL_TABS: { id: View; label: string; roles: Role[] }[] = [
  { id: "inbox", label: "Inbox", roles: ["Owner", "Office"] },
  { id: "jobs", label: "Jobs", roles: ["Owner", "Office", "Crew welder"] },
  { id: "schedule", label: "Schedule", roles: ["Owner", "Office", "Crew welder"] },
  { id: "invoices", label: "Invoices", roles: ["Owner", "Office"] },
  { id: "customers", label: "Customers", roles: ["Owner", "Office"] },
];

const SEED_QUOTES: Quote[] = [
  {
    id: "Q-2026-118",
    title: "Commercial staircase package",
    who: "M. Serrano · GC · Fort Worth",
    phone: "(817) 555-0142",
    desc: "Two-flight steel stair with landings and 60 ft of handrail for a distribution building. Drawings in hand.",
    meta: "Structural · Carbon · This month",
    slot: "Callback done",
    status: "Quoted",
    custEst: "$42,000 – $50,000 · 140–160 hrs",
  },
  {
    id: "Q-2026-121",
    title: "Frac tank seam leak",
    who: "D. Whitfield · Plant · Granbury",
    phone: "(817) 555-0177",
    desc: "500-bbl frac tank weeping at a bottom seam. Needs it stopped before Monday transfer.",
    meta: "Equipment · Carbon · Emergency",
    slot: "Wants a call today",
    status: "New",
    custEst: "",
  },
  {
    id: "Q-2026-124",
    title: "Ranch entry gate build",
    who: "J. McAllen · Ranch · Glen Rose",
    phone: "(254) 555-0128",
    desc: "16 ft double swing gate off a photo of the entry. Wants a longhorn silhouette panel later, off the CNC table.",
    meta: "Fabrication · Carbon · Flexible",
    slot: "Thu · Morning",
    status: "Called",
    custEst: "$2,750 – $3,500 · 24–30 hrs",
  },
];

const SEED_JOBS: Job[] = [
  { code: "JOB-2026-014", title: "Commercial staircase package", meta: "3 welders · 150 hrs", stage: 1 },
  { code: "JOB-2026-016", title: "Handrail run · office entry", meta: "1 welder · 20 hrs", stage: 1 },
  { code: "JOB-2026-015", title: "Hot oil bed rebuild", meta: "2 welders · shop", stage: 2 },
  { code: "JOB-2026-017", title: "Ranch entry gate", meta: "Quoted at $3,200", stage: 0 },
  { code: "JOB-2026-009", title: "Frac tank seam repair", meta: "On location · closed", stage: 3 },
  { code: "JOB-2025-033", title: "Process pipe tie-in", meta: "Outage window · closed", stage: 3 },
];

const SEED_INVOICES: Invoice[] = [
  { id: "INV-042", job: "Handrail run · office entry", customer: "Serrano Builds", amount: "$6,250", paid: false },
  { id: "INV-041", job: "Commercial staircase package", customer: "Serrano Builds", amount: "$50,000", paid: false },
  { id: "INV-039", job: "Excavator bucket rebuild", customer: "Boyd Equipment", amount: "$3,250", paid: true },
  { id: "INV-038", job: "Process pipe tie-in", customer: "Brazos Processing", amount: "$7,500", paid: true },
];

const CUSTOMERS = [
  { name: "Serrano Builds", town: "Fort Worth", type: "Contractor", jobs: 3, billed: "$58,400" },
  { name: "Brazos Processing", town: "Granbury", type: "Plant", jobs: 2, billed: "$11,900" },
  { name: "Boyd Equipment", town: "Cleburne", type: "Equipment", jobs: 2, billed: "$5,750" },
  { name: "McAllen Ranch", town: "Glen Rose", type: "Ranch", jobs: 1, billed: "$1,850" },
  { name: "Whitfield Ops", town: "Granbury", type: "Plant", jobs: 1, billed: "$2,400" },
];

const STAGES = ["Quoted", "Scheduled", "In progress", "Done"];
const STAGE_COLORS = ["#7fd4ff", "#ffb020", "#c90314", "#3ec96a"];

const STATUS_COLORS: Record<string, string> = {
  New: "#c90314",
  Called: "#ffb020",
  Quoted: "#7fd4ff",
  Won: "#3ec96a",
  Lost: "rgba(255,255,255,.4)",
};

const statusColor = (st: string) => STATUS_COLORS[st] || "#ffffff";

// Static mock bid for the prototype. The live estimator ran on internal
// economics; rates redacted — wire to Convex later.
const MOCK_BID: InternalBid = {
  bidLow: 2500,
  bidHigh: 3250,
  crew: 1,
  hoursLow: 16,
  hoursHigh: 20,
  marginPct: 33,
  note: "Fallback numbers from typical jobs of this size. Confirm scope on the callback.",
  risks: ["Scope unclear until photos arrive"],
};

/** Quotes submitted through /quote land in localStorage; merge them ahead of the seeds. */
function readStoredQuotes(): Quote[] {
  try {
    const raw = JSON.parse(localStorage.getItem("tsws_quotes") || "[]") as StoredQuote[];
    return raw.map((q) => ({
      id: q.id || "Q-????",
      title: q.est?.title || q.f?.type || "Quote request",
      who: (q.c?.name || "Customer") + (q.c?.company ? " · " + q.c.company : "") + " · via site",
      phone: q.c?.phone || "",
      desc: q.f?.desc || "",
      meta: [q.f?.type, q.f?.material, q.f?.timeline].filter(Boolean).join(" · "),
      slot: q.slot || "",
      status: q.status || "New",
      custEst: q.est
        ? "$" +
          Number(q.est.dollars_low).toLocaleString() +
          " – $" +
          Number(q.est.dollars_high).toLocaleString() +
          " · " +
          q.est.hours_low +
          "–" +
          q.est.hours_high +
          " hrs"
        : "",
    }));
  } catch {
    return [];
  }
}

/** Mono spec label. `ls` in em; pass null for none. `upper` mirrors the dc markup. */
function mono(size: number, ls: number | null, color: string, upper = true): CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: size,
    letterSpacing: ls != null ? `${ls}em` : undefined,
    textTransform: upper ? "uppercase" : undefined,
    color,
  };
}

const specNum: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStyle: "oblique 10deg",
  fontSize: 26,
  color: "#ffffff",
};

export default function CrewConsole() {
  const [user, setUser] = useState<CrewUser | null>(null);
  const [pendingUser, setPendingUser] = useState<CrewUser | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [view, setView] = useState<View>("inbox");
  const [quotes, setQuotes] = useState<Quote[]>(SEED_QUOTES);
  const [selId, setSelId] = useState<string | null>(SEED_QUOTES[0].id);
  const [internal, setInternal] = useState<Record<string, InternalBid>>({});
  const [internalBusyId, setInternalBusyId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>(SEED_JOBS);
  const [invoices, setInvoices] = useState<Invoice[]>(SEED_INVOICES);
  const bidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedStored = useRef(false);

  useEffect(
    () => () => {
      if (bidTimer.current) clearTimeout(bidTimer.current);
    },
    [],
  );

  // SECURITY: this PIN gate is a mock, not authentication. Any 4 digits pass
  // and every quote shown is seed data or this browser's own localStorage.
  // Do NOT wire /crew to real Convex reads until real auth exists (and
  // consider gating the route behind Cloudflare Access when it goes live).
  const login = () => {
    if (!pendingUser) {
      setPinError("Pick a login above.");
      return;
    }
    if (pin.replace(/\D/g, "").length !== 4) {
      setPinError("Enter a 4-digit PIN.");
      return;
    }
    if (!loadedStored.current) {
      loadedStored.current = true;
      const merged = [...readStoredQuotes(), ...SEED_QUOTES];
      setQuotes(merged);
      setSelId(merged[0] ? merged[0].id : null);
    }
    setPinError("");
    setUser(pendingUser);
    setView(pendingUser.role === "Crew welder" ? "jobs" : "inbox");
  };

  const logout = () => {
    setPendingUser(null);
    setUser(null);
    setPin("");
  };

  const setStatus = (id: string, status: string) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    try {
      const list = JSON.parse(localStorage.getItem("tsws_quotes") || "[]") as StoredQuote[];
      const hit = list.find((x) => x.id === id);
      if (hit) {
        hit.status = status;
        localStorage.setItem("tsws_quotes", JSON.stringify(list));
      }
    } catch {
      // storage unavailable; in-memory status still updates
    }
  };

  const runInternal = () => {
    const q = quotes.find((x) => x.id === selId);
    if (!q || internalBusyId) return;
    const id = q.id;
    setInternalBusyId(id);
    // Prototype: short delay, then the static mock numbers.
    bidTimer.current = setTimeout(() => {
      setInternal((prev) => ({ ...prev, [id]: MOCK_BID }));
      setInternalBusyId(null);
    }, 1100);
  };

  /* ---------- login screen ---------- */

  if (!user) {
    return (
      <main style={{ background: "#080808", minHeight: "100vh" }}>
        <div className="crew-login-wrap">
          <div className="crew-login-card">
            <HazardBar variant="red" height="6px" />
            <div className="crew-login-body">
              <BadgeImg src="/logo-badge.png" alt="TSWS badge" style={{ height: 72, width: "auto", maxWidth: "100%", objectFit: "contain", alignSelf: "flex-start" }} />
              <div>
                <h1 className="crew-login-title">Crew console</h1>
                <div style={{ ...mono(11, 0.16, "rgba(255,255,255,.5)"), marginTop: 6 }}>
                  Quotes · jobs · schedule · invoices
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {USERS.map((u) => {
                  const picked = pendingUser?.name === u.name;
                  return (
                    <button
                      key={u.name}
                      type="button"
                      className="crew-hov-red"
                      onClick={() => {
                        setPendingUser(u);
                        setPinError("");
                      }}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        background: picked ? "#1b1e21" : "#101214",
                        border: `1px solid ${picked ? "#c90314" : "rgba(255,255,255,.12)"}`,
                        color: "#ffffff",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600 }}>{u.name}</span>
                      <span style={mono(10, 0.16, "rgba(255,255,255,.55)")}>{u.role}</span>
                    </button>
                  );
                })}
              </div>
              <Input
                label="PIN"
                value={pin}
                onChange={(v) => setPin(v)}
                placeholder="Any 4 digits in this prototype"
                error={pinError || undefined}
                inputMode="numeric"
                autoComplete="off"
              />
              <Button variant="primary" size="lg" block onClick={login}>
                Open the console
              </Button>
              <div style={mono(10, 0.14, "rgba(255,255,255,.38)")}>
                Each login sees its own screens. Production build gets real accounts.
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- console ---------- */

  const tabs = ALL_TABS.filter((t) => t.roles.includes(user.role));
  const sel = quotes.find((q) => q.id === selId) ?? null;
  const bid = sel ? internal[sel.id] : undefined;

  const scheduleRows = [
    ...quotes
      .filter((q) => q.slot && q.slot.includes("·"))
      .map((q) => ({
        when: q.slot,
        title: "Callback · " + q.title,
        meta: q.who,
        tag: "Callback",
        color: "#7fd4ff",
      })),
    { when: "Sat · 6a–6p", title: "Staircase install · day 1 of 2", meta: "3 welders · Fort Worth", tag: "Install", color: "#ffb020" },
    { when: "Sun · 6a–6p", title: "Staircase install · day 2 of 2", meta: "3 welders · Fort Worth", tag: "Install", color: "#ffb020" },
    { when: "Mon–Wed", title: "Hot oil bed rebuild · shop", meta: "2 welders · Granbury shop", tag: "Shop", color: "#3ec96a" },
    { when: "Standing", title: "Emergency line open 24/7", meta: "(817) 894-6357 rings Eric", tag: "On call", color: "#c90314" },
  ];

  return (
    <main style={{ background: "#080808", minHeight: "100vh" }}>
      <div className="crew-topbar">
        <HazardBar variant="red" height="4px" />
        <div className="crew-topbar-inner">
          <BadgeImg src="/logo-badge.png" alt="TSWS" style={{ height: 36 }} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontStyle: "oblique 10deg",
              fontSize: 20,
              textTransform: "uppercase",
              color: "#ffffff",
            }}
          >
            Crew console
          </span>
          <div className="crew-tabs">
            {tabs.map((t) => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="crew-tab"
                  onClick={() => setView(t.id)}
                  style={{
                    cursor: "pointer",
                    padding: "10px 16px",
                    background: active ? "#16181b" : "transparent",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    borderBottom: `2px solid ${active ? "#c90314" : "transparent"}`,
                    ...mono(11, 0.16, active ? "#ffffff" : "rgba(255,255,255,.55)"),
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="crew-topbar-right">
            <span style={mono(11, 0.14, "rgba(255,255,255,.6)")}>
              {user.name} · {user.role}
            </span>
            <button
              type="button"
              className="crew-hov-red"
              onClick={logout}
              style={{
                cursor: "pointer",
                background: "none",
                border: "1px solid rgba(255,255,255,.16)",
                padding: "8px 14px",
                ...mono(10, 0.14, "#ffffff"),
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="crew-main">
        {view === "inbox" && (
          <div className="crew-inbox-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...mono(11, 0.18, "rgba(255,255,255,.5)"), padding: "0 4px" }}>
                Quote inbox · {quotes.length} open
              </div>
              {quotes.map((q) => {
                const selected = selId === q.id;
                const col = statusColor(q.status);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className="crew-hov-red"
                    onClick={() => setSelId(q.id)}
                    style={{
                      cursor: "pointer",
                      textAlign: "left",
                      background: selected ? "#16181b" : "#0d0e0f",
                      borderTop: `1px solid ${selected ? "rgba(201,3,20,.6)" : "rgba(255,255,255,.1)"}`,
                      borderRight: `1px solid ${selected ? "rgba(201,3,20,.6)" : "rgba(255,255,255,.1)"}`,
                      borderBottom: `1px solid ${selected ? "rgba(201,3,20,.6)" : "rgba(255,255,255,.1)"}`,
                      borderLeft: `3px solid ${col}`,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      color: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <span style={mono(11, 0.12, "rgba(255,255,255,.6)", false)}>{q.id}</span>
                      <span style={mono(9, 0.14, col)}>{q.status}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600 }}>{q.title}</span>
                    <span style={mono(10, 0.12, "rgba(255,255,255,.45)")}>{q.who}</span>
                  </button>
                );
              })}
            </div>

            {sel && (
              <div className="crew-detail">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={mono(11, 0.16, "rgba(255,255,255,.5)")}>
                      {sel.id} · {sel.slot || ""}
                    </div>
                    <h2 className="crew-detail-title">{sel.title}</h2>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["New", "Called", "Quoted", "Won", "Lost"].map((st) => {
                      const active = sel.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          className="crew-hov-red"
                          onClick={() => setStatus(sel.id, st)}
                          style={{
                            cursor: "pointer",
                            padding: "8px 12px",
                            border: `1px solid ${active ? statusColor(st) : "rgba(255,255,255,.14)"}`,
                            background: active ? "rgba(255,255,255,.06)" : "transparent",
                            ...mono(10, 0.14, "#ffffff"),
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="crew-two-col">
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,.1)",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={mono(10, 0.16, "rgba(255,255,255,.5)")}>Customer</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "#ffffff" }}>
                      {sel.who}
                    </div>
                    <div style={mono(12, null, "rgba(255,255,255,.7)", false)}>{sel.phone}</div>
                    <div style={mono(12, null, "rgba(255,255,255,.7)", false)}>
                      Callback: {sel.slot || "none picked"}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,.1)",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={mono(10, 0.16, "rgba(255,255,255,.5)")}>Job</div>
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "rgba(255,255,255,.8)",
                      }}
                    >
                      {sel.desc}
                    </div>
                    <div style={mono(11, 0.1, "rgba(255,255,255,.55)")}>{sel.meta}</div>
                  </div>
                </div>

                {sel.custEst ? (
                  <div style={{ border: "1px solid rgba(255,255,255,.1)", padding: 16 }}>
                    <div style={{ ...mono(10, 0.16, "rgba(255,255,255,.5)"), marginBottom: 8 }}>
                      What the customer saw
                    </div>
                    <div style={mono(13, null, "#eef0f1", false)}>{sel.custEst}</div>
                  </div>
                ) : null}

                <div
                  style={{
                    border: "1px solid rgba(255,176,32,.4)",
                    background: "rgba(255,176,32,.04)",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={mono(10, 0.16, "#ffb020")}>Internal bid draft · rates never leave this screen</div>
                    <Button variant="secondary" size="sm" onClick={runInternal} disabled={!!internalBusyId}>
                      {bid ? "Redraft the bid" : "Draft the bid"}
                    </Button>
                  </div>
                  {internalBusyId ? (
                    <div
                      style={{
                        width: 220,
                        maxWidth: "100%",
                        height: 3,
                        background: "rgba(255,255,255,.1)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "40%",
                          height: "100%",
                          background: "#ffb020",
                          animation: "crew-sweep 1.1s linear infinite",
                        }}
                      />
                    </div>
                  ) : null}
                  {bid ? (
                    <>
                      <div className="crew-bid-stats">
                        <div>
                          <div style={mono(9, 0.16, "rgba(255,255,255,.5)")}>Bid range</div>
                          <div style={specNum}>
                            ${bid.bidLow.toLocaleString()}–{bid.bidHigh.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div style={mono(9, 0.16, "rgba(255,255,255,.5)")}>Crew</div>
                          <div style={specNum}>{bid.crew}</div>
                        </div>
                        <div>
                          <div style={mono(9, 0.16, "rgba(255,255,255,.5)")}>Man-hours</div>
                          <div style={specNum}>
                            {bid.hoursLow}–{bid.hoursHigh}
                          </div>
                        </div>
                        <div>
                          <div style={mono(9, 0.16, "rgba(255,255,255,.5)")}>Est. margin</div>
                          <div style={{ ...specNum, color: "#3ec96a" }}>~{bid.marginPct}%</div>
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "rgba(255,255,255,.78)",
                        }}
                      >
                        {bid.note}
                      </div>
                      {bid.risks.map((r) => (
                        <div
                          key={r}
                          style={{
                            display: "flex",
                            gap: 10,
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            color: "rgba(255,255,255,.65)",
                          }}
                        >
                          <span style={{ color: "#ffb020" }}>◆</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button variant="primary" href={sel.phone ? "tel:" + sel.phone.replace(/\D/g, "") : "#"}>
                    Call the customer
                  </Button>
                  <Button variant="ghost" href="mailto:eric@tidwellwelding.com">
                    Email the quote
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "jobs" && (
          <div className="crew-kanban">
            {STAGES.map((name, i) => {
              const items = jobs.filter((j) => j.stage === i);
              return (
                <div key={name} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    style={{
                      ...mono(11, 0.18, STAGE_COLORS[i]),
                      borderBottom: `2px solid ${STAGE_COLORS[i]}`,
                      paddingBottom: 8,
                    }}
                  >
                    {name} · {items.length}
                  </div>
                  {items.map((j) => (
                    <div
                      key={j.code}
                      style={{
                        background: "#0d0e0f",
                        border: "1px solid rgba(255,255,255,.1)",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <span style={mono(10, 0.12, "rgba(255,255,255,.5)", false)}>{j.code}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                        {j.title}
                      </span>
                      <span style={mono(10, 0.1, "rgba(255,255,255,.5)")}>{j.meta}</span>
                      {i < 3 ? (
                        <button
                          type="button"
                          className="crew-hov-red"
                          onClick={() =>
                            setJobs((prev) =>
                              prev.map((x) => (x.code === j.code ? { ...x, stage: x.stage + 1 } : x)),
                            )
                          }
                          style={{
                            cursor: "pointer",
                            alignSelf: "flex-start",
                            background: "none",
                            border: "1px solid rgba(255,255,255,.16)",
                            padding: "6px 10px",
                            ...mono(9, 0.14, "#ffffff"),
                          }}
                        >
                          Move to {STAGES[i + 1]}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {view === "schedule" && (
          <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={mono(11, 0.18, "rgba(255,255,255,.5)")}>Next two weeks</div>
            {scheduleRows.map((ev) => (
              <div
                key={ev.when + ev.title}
                className="crew-schedule-row"
                style={{ borderLeft: `3px solid ${ev.color}` }}
              >
                <span style={mono(12, 0.12, "rgba(255,255,255,.7)")}>{ev.when}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "#ffffff" }}>
                    {ev.title}
                  </div>
                  <div style={{ ...mono(10, 0.12, "rgba(255,255,255,.45)"), marginTop: 2 }}>{ev.meta}</div>
                </div>
                <span
                  className="crew-schedule-tag"
                  style={{
                    ...mono(9, 0.14, ev.color),
                    border: `1px solid ${ev.color}`,
                    padding: "4px 8px",
                  }}
                >
                  {ev.tag}
                </span>
              </div>
            ))}
          </div>
        )}

        {view === "invoices" && (
          <div className="crew-table-scroll" style={{ maxWidth: 1000, border: "1px solid rgba(255,255,255,.1)" }}>
            <div
              className="crew-invoice-cols"
              style={{
                padding: "12px 18px",
                background: "#101214",
                borderBottom: "1px solid rgba(255,255,255,.1)",
                ...mono(10, 0.18, "rgba(255,255,255,.5)"),
              }}
            >
              <span>Invoice</span>
              <span>Job</span>
              <span>Customer</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {invoices.map((inv) => {
              const col = inv.paid ? "#3ec96a" : "#ffb020";
              return (
                <div
                  key={inv.id}
                  className="crew-invoice-cols"
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                    alignItems: "center",
                  }}
                >
                  <span style={mono(12, null, "rgba(255,255,255,.7)", false)}>{inv.id}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#ffffff" }}>{inv.job}</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "rgba(255,255,255,.65)" }}>
                    {inv.customer}
                  </span>
                  <span style={{ ...mono(13, null, "#ffffff", false), textAlign: "right" }}>{inv.amount}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setInvoices((prev) =>
                        prev.map((x) => (x.id === inv.id ? { ...x, paid: !x.paid } : x)),
                      )
                    }
                    style={{
                      cursor: "pointer",
                      justifySelf: "end",
                      background: "none",
                      border: `1px solid ${col}`,
                      padding: "5px 10px",
                      ...mono(9, 0.14, col),
                    }}
                  >
                    {inv.paid ? "Paid" : "Sent"}
                  </button>
                </div>
              );
            })}
            <div style={{ padding: "12px 18px", ...mono(10, 0.14, "rgba(255,255,255,.4)"), minWidth: 720 }}>
              Tap a status to mark paid. Production build syncs to invoicing.
            </div>
          </div>
        )}

        {view === "customers" && (
          <div className="crew-table-scroll" style={{ maxWidth: 1000, border: "1px solid rgba(255,255,255,.1)" }}>
            <div
              className="crew-cust-cols"
              style={{
                padding: "12px 18px",
                background: "#101214",
                borderBottom: "1px solid rgba(255,255,255,.1)",
                ...mono(10, 0.18, "rgba(255,255,255,.5)"),
              }}
            >
              <span>Customer</span>
              <span>Town</span>
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Jobs</span>
              <span style={{ textAlign: "right" }}>Billed</span>
            </div>
            {CUSTOMERS.map((cu) => (
              <div
                key={cu.name}
                className="crew-cust-cols"
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(255,255,255,.06)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
                  {cu.name}
                </span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "rgba(255,255,255,.65)" }}>
                  {cu.town}
                </span>
                <span style={mono(10, 0.12, "rgba(255,255,255,.55)")}>{cu.type}</span>
                <span style={{ ...mono(13, null, "#ffffff", false), textAlign: "right" }}>{cu.jobs}</span>
                <span style={{ ...mono(13, null, "#ffffff", false), textAlign: "right" }}>{cu.billed}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
