"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useConvex } from "convex/react";
import { Turnstile } from "@marsidev/react-turnstile";
import { api } from "../../../../convex/_generated/api";
import { Badge, Button, Card, HazardBar, Icon, Input, Select } from "@/components/ds";
import { getSessionId } from "@/lib/session";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const MONO = "var(--font-mono)";
const DISPLAY = "var(--font-display)";
const BODY = "var(--font-body)";

type LineItem = { task: string; crew: number; hours: number };

type Estimate = {
  title: string;
  summary: string;
  line_items: LineItem[];
  hours_low: number;
  hours_high: number;
  // Absent when the server withholds dollars on a low-confidence draft.
  dollars_low?: number;
  dollars_high?: number;
  confidence?: "high" | "medium" | "low";
  dollarsWithheld?: boolean;
  questions?: string[];
};

type JobFields = {
  type: string;
  material: string;
  desc: string;
  dims: string;
  timeline: string;
  location: string;
  compQuote: string;
  photos: string[];
  compFile: string;
};

type ContactFields = {
  name: string;
  company: string;
  phone: string;
  email: string;
};

const STEP_NAMES = ["The job", "Contact", "Estimate & slot", "Done"];

const TYPE_OPTIONS = [
  "Fabrication (new build)",
  "Staircase / handrail / structural",
  "Pipe welding",
  "Heavy equipment repair",
  "Mobile / on-site repair",
  "Emergency",
];

const MATERIAL_OPTIONS = [
  "Carbon steel",
  "Stainless",
  "Aluminum",
  "Inconel",
  "Chrome-moly",
  "Not sure",
];

const TIMELINE_OPTIONS = [
  "Emergency. Right now.",
  "This week",
  "Next two weeks",
  "Flexible",
];

/** Static fallback ported verbatim from quote.dc.html. */
function fallbackEstimate(jobType: string): Estimate {
  const mobile = jobType === "Mobile / on-site repair" || jobType === "Emergency";
  const items: LineItem[] = [
    { task: "Assess, prep and fit-up", crew: 1, hours: 2 },
    { task: "Weld-out", crew: 1, hours: 4 },
    { task: "Grind, dress and inspect", crew: 1, hours: 1 },
  ];
  if (mobile) items.unshift({ task: "Mobilize the truck to site", crew: 1, hours: 1 });
  return {
    title: "Draft estimate",
    summary:
      "A working draft based on jobs like yours. Eric firms up the numbers on the callback.",
    line_items: items,
    hours_low: 6,
    hours_high: 10,
    confidence: "low",
    dollarsWithheld: true,
    questions: ["Exact sizes and material thickness", "Site access and power"],
  };
}

/** Callback slot generator ported verbatim from quote.dc.html. */
function makeSlots() {
  const out: { label: string; day: string; time: string }[] = [];
  const d = new Date();
  let added = 0;
  while (added < 5) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const day = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    out.push({ label: day + " · Morning", day, time: "8a–12p" });
    out.push({ label: day + " · Afternoon", day, time: "1p–5p" });
    added++;
  }
  return out;
}

function makeRequestId(): string {
  return (
    "Q-" + new Date().getFullYear() + "-" + String(Math.floor(100 + Math.random() * 900))
  );
}

const fmt = (n: number) => "$" + Number(n || 0).toLocaleString("en-US");

/* ---- shared style fragments (1280px desktop comp, quote.dc.html) ---- */

const kicker: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
  marginBottom: 14,
};

const panelChamfer: CSSProperties = {
  background: "#0d0e0f",
  border: "1px solid rgba(255,255,255,.1)",
  borderTop: "3px solid #c90314",
  clipPath:
    "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
};

const stepKicker: CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.5)",
};

const h2Style: CSSProperties = {
  fontFamily: DISPLAY,
  fontWeight: 900,
  fontStyle: "oblique 10deg",
  textTransform: "uppercase",
  color: "#ffffff",
  margin: "8px 0 0",
};

const fileLabelText: CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.7)",
};

const fileDropText: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "1px dashed rgba(255,255,255,.45)",
  padding: 22,
  fontFamily: BODY,
  fontSize: 14,
  color: "rgba(255,255,255,.6)",
  textAlign: "center",
};

/** Visually hidden but still focusable/announced (never display:none). */
const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

/** File inputs stay in the tab order; the label's :focus-within draws the ring. */
const hiddenFileInput: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

/** Validation-key → control id, in visual order, for focus-to-first-invalid. */
const ERR_FIELD_IDS: Record<string, string> = {
  type: "qf-type",
  desc: "qf-desc",
  name: "qf-name",
  phone: "qf-phone",
};

function focusFirstInvalid(order: string[], next: Record<string, string>) {
  const first = order.find((key) => next[key]);
  if (first) document.getElementById(ERR_FIELD_IDS[first])?.focus();
}

const css = `
.qf-hero { max-width: 1280px; margin: 0 auto; padding: 72px 32px 40px; }
.qf-body { max-width: 1280px; margin: 0 auto; padding: 0 32px 96px; }
.qf-h1 { font-size: 68px; }
.qf-h2 { font-size: 36px; }
.qf-h2-lg { font-size: 44px; }
.qf-steps { display: flex; gap: 0; margin: 36px 0 0; padding: 0; list-style: none; border: 1px solid rgba(255,255,255,.12); max-width: 820px; }
.qf-step { flex: 1; padding: 12px 16px; border-right: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 10px; }
.qf-grid-main { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 48px; align-items: start; }
.qf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.qf-pad { padding: 32px; }
.qf-pad-lg { padding: 40px; }
.qf-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.qf-li-row { display: grid; grid-template-columns: 1fr 90px 90px; }
.qf-slots { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.qf-slot { cursor: pointer; padding: 12px 8px; text-align: center; border: 1px solid var(--qf-slot-border); background: var(--qf-slot-bg); color: #ffffff; display: flex; flex-direction: column; gap: 4px; align-items: center; }
.qf-slot:hover { border-color: rgba(201,3,20,.7); }
.qf-emergency:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--black-900), inset 0 0 0 4px var(--arc-blue); }
.qf-file:focus-within .qf-file__drop { box-shadow: inset 0 0 0 2px var(--black-900), inset 0 0 0 4px var(--arc-blue); }
.qf-focus-target:focus { outline: none; box-shadow: none; }
.qf-sweep-track { width: 220px; height: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
.qf-sweep { width: 40%; height: 100%; background: #c90314; animation: qf-sweep 1.1s linear infinite; }
@keyframes qf-sweep { from { transform: translateX(-260%); } to { transform: translateX(650%); } }
@media (prefers-reduced-motion: reduce) { .qf-sweep { animation: none; } }
@media (max-width: 1023px) {
  .qf-grid-main { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 767px) {
  .qf-hero { padding: 56px 20px 32px; }
  .qf-body { padding: 0 20px 72px; }
  .qf-h1 { font-size: 46px; }
  .qf-h2 { font-size: 30px; }
  .qf-h2-lg { font-size: 36px; }
  .qf-steps { flex-wrap: wrap; }
  .qf-step { flex: 1 1 50%; box-sizing: border-box; border-bottom: 1px solid rgba(255,255,255,.08); }
  .qf-step:nth-last-child(-n+2) { border-bottom: 0; }
  .qf-pad { padding: 24px 20px; }
  .qf-pad-lg { padding: 28px 20px; }
  .qf-li-row { grid-template-columns: 1fr 64px 64px; }
  .qf-slots { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 639px) {
  .qf-grid-2 { grid-template-columns: 1fr; }
}
`;

export default function QuoteFlow() {
  // Plain context read: undefined when ConvexClientProvider rendered without
  // a client (NEXT_PUBLIC_CONVEX_URL unset). Every call below is try/caught
  // so the flow falls back and never crashes the page.
  const convex = useConvex();

  const [step, setStep] = useState(1);
  const [f, setJob] = useState<JobFields>({
    type: "",
    material: "",
    desc: "",
    dims: "",
    timeline: "",
    location: "",
    compQuote: "",
    photos: [],
    compFile: "",
  });
  const [c, setContact] = useState<ContactFields>({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [est, setEst] = useState<Estimate | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [slot, setSlot] = useState("");
  const [reqId, setReqId] = useState(makeRequestId);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const slots = useMemo(() => makeSlots(), []);

  // 2.4.3: step transitions unmount the activating button; move focus to the
  // new step's heading (or the drafting panel) so keyboard/SR users land there.
  const step2HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const step4HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const draftingPanelRef = useRef<HTMLDivElement | null>(null);
  const estHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const prevStepRef = useRef(step);

  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    if (step === 2) step2HeadingRef.current?.focus();
    else if (step === 3) draftingPanelRef.current?.focus();
    else if (step === 4) step4HeadingRef.current?.focus();
  }, [step]);

  // When the drafting panel unmounts, focus would drop to <body>; catch it on
  // the estimate heading instead. Never steals focus the user placed elsewhere.
  useEffect(() => {
    if (!est || estBusy) return;
    const active = document.activeElement;
    if (!active || active === document.body) estHeadingRef.current?.focus();
  }, [est, estBusy]);

  const setF = (k: keyof JobFields) => (value: string) => {
    setJob((prev) => ({ ...prev, [k]: value }));
    setErrs((prev) => ({ ...prev, [k]: "" }));
  };
  const setC = (k: keyof ContactFields) => (value: string) => {
    setContact((prev) => ({ ...prev, [k]: value }));
    setErrs((prev) => ({ ...prev, [k]: "" }));
  };

  const toStep2 = () => {
    const next: Record<string, string> = {};
    if (!f.type) next.type = "Pick a job type.";
    if (!f.desc.trim()) next.desc = "Describe the job in a sentence or two.";
    if (Object.keys(next).length) {
      setErrs(next);
      focusFirstInvalid(["type", "desc"], next);
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const runEstimate = async () => {
    setEstBusy(true);
    setEst(null);
    const started = Date.now();
    let result: Estimate;
    try {
      if (!convex) throw new Error("Convex client unavailable");
      result = await convex.action(api.estimate.draftEstimate, {
        type: f.type,
        material: f.material || undefined,
        desc: f.desc,
        dims: f.dims || undefined,
        timeline: f.timeline || undefined,
        location: f.location || undefined,
        compQuote: f.compQuote || undefined,
        photoNames: f.photos.length ? f.photos : undefined,
        sessionId: getSessionId(),
        turnstileToken: turnstileToken || "dev",
      });
    } catch {
      result = fallbackEstimate(f.type);
    }
    // Keep the drafting panel visible long enough to read when the
    // fallback answers instantly.
    const elapsed = Date.now() - started;
    if (elapsed < 700) {
      await new Promise((resolve) => setTimeout(resolve, 700 - elapsed));
    }
    setEst(result);
    setEstBusy(false);
  };

  const toStep3 = () => {
    const next: Record<string, string> = {};
    if (!c.name.trim()) next.name = "Enter your name.";
    if (c.phone.replace(/\D/g, "").length !== 10) next.phone = "Enter a 10-digit number.";
    if (Object.keys(next).length) {
      setErrs(next);
      focusFirstInvalid(["name", "phone"], next);
      return;
    }
    setStep(3);
    window.scrollTo(0, 0);
    void runEstimate();
  };

  const backTo1 = () => setStep(1);

  const submit = async () => {
    if (!slot || submitting) return;
    setSubmitting(true);
    let finalId = reqId;
    try {
      if (convex) {
        const res = await convex.action(api.quotes.submitQuote, {
          requestId: reqId,
          name: c.name,
          company: c.company || undefined,
          phone: c.phone,
          email: c.email || undefined,
          job: {
            type: f.type,
            material: f.material || undefined,
            desc: f.desc,
            dims: f.dims || undefined,
            timeline: f.timeline || undefined,
            location: f.location || undefined,
            compQuote: f.compQuote || undefined,
            photoNames: f.photos.length ? f.photos : undefined,
          },
          estimate: est ?? undefined,
          slot,
          sessionId: getSessionId(),
          turnstileToken: turnstileToken || "dev",
        });
        if (res?.requestId) finalId = res.requestId;
      }
    } catch {
      // Backend unreachable or unverified: keep the provisional id so the
      // request still lands in local history for the owner.
    }
    try {
      const key = "tsws_quotes";
      const list = JSON.parse(window.localStorage.getItem(key) || "[]");
      list.unshift({
        id: finalId,
        ts: Date.now(),
        f,
        c,
        est,
        slot,
        status: "New",
      });
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
    } catch {
      // Storage blocked: the confirmation still shows.
    }
    setReqId(finalId);
    setSubmitting(false);
    setStep(4);
    window.scrollTo(0, 0);
  };

  const isEmergency = f.timeline === "Emergency. Right now." || f.type === "Emergency";
  const estReady = !!est && !estBusy;
  const photoLabel = f.photos.length
    ? f.photos.length + " file(s): " + f.photos.join(", ")
    : "Tap to attach. Two angles beat ten words.";
  const compFileLabel = f.compFile || "Tap to attach the other shop's quote.";

  return (
    <div style={{ background: "#080808" }}>
      <style>{css}</style>

      <section className="qf-hero">
        <div style={kicker}>Quote intake · Free · AI assisted</div>
        <h1
          className="qf-h1"
          style={{
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontStyle: "oblique 10deg",
            lineHeight: 0.88,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "#ffffff",
            margin: 0,
          }}
        >
          Describe the job. Get working <span style={{ color: "#c90314" }}>numbers</span>.
        </h1>
        <ol className="qf-steps" aria-label="Quote progress">
          {STEP_NAMES.map((label, i) => (
            <li
              key={label}
              className="qf-step"
              aria-current={step === i + 1 ? "step" : undefined}
              style={{ background: step === i + 1 ? "#16181b" : "transparent" }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 900,
                  fontStyle: "oblique 10deg",
                  fontSize: 20,
                  lineHeight: 1,
                  color:
                    step > i + 1
                      ? "#3ec96a"
                      : step === i + 1
                        ? "#e01625"
                        : "rgba(255,255,255,.4)",
                }}
              >
                {"0" + (i + 1)}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: step === i + 1 ? "#ffffff" : "rgba(255,255,255,.55)",
                }}
              >
                {label}
              </span>
              {step > i + 1 ? <span style={srOnly}>(completed)</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="qf-body">
        {step === 1 ? (
          <div className="qf-grid-main">
            <div
              className="qf-pad"
              style={{ display: "flex", flexDirection: "column", gap: 20, ...panelChamfer }}
            >
              <div className="qf-grid-2">
                <Select
                  label="Job type"
                  id="qf-type"
                  required
                  value={f.type}
                  onChange={setF("type")}
                  options={TYPE_OPTIONS}
                  placeholder="Pick one"
                  error={errs.type || ""}
                />
                <Select
                  label="Material"
                  value={f.material}
                  onChange={setF("material")}
                  options={MATERIAL_OPTIONS}
                  placeholder="If you know it"
                />
              </div>
              <Input
                label="What needs welding or building"
                id="qf-desc"
                required
                multiline
                rows={4}
                value={f.desc}
                onChange={setF("desc")}
                placeholder="Cracked bucket ear on a 320 excavator. Crack runs about 8 in along the pin boss."
                hint="Sizes, counts and what broke. Write it like a text message."
                error={errs.desc || ""}
              />
              <div className="qf-grid-2">
                <Input
                  label="Rough dimensions"
                  value={f.dims}
                  onChange={setF("dims")}
                  placeholder="8 in crack · 3/4 in plate"
                />
                <Select
                  label="Timeline"
                  value={f.timeline}
                  onChange={setF("timeline")}
                  options={TIMELINE_OPTIONS}
                  placeholder="When do you need it"
                />
              </div>
              {isEmergency ? (
                <a
                  href="tel:8178946357"
                  className="qf-emergency"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                    textDecoration: "none",
                    background: "linear-gradient(180deg, #e2101f 0%, #a00210 100%)",
                    color: "#ffffff",
                    padding: "16px 20px",
                    clipPath:
                      "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    Emergency? Skip the form.
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: 900,
                      fontStyle: "oblique 10deg",
                      fontSize: 24,
                      lineHeight: 1,
                    }}
                  >
                    Call (817) 894-6357
                  </span>
                </a>
              ) : null}
              <div className="qf-grid-2">
                <Input
                  label="Where the work sits"
                  value={f.location}
                  onChange={setF("location")}
                  placeholder="Shop drop-off, or an address / town"
                  hint="Site access notes help: gates, power, overhead lines."
                />
                <Input
                  label="Quote you already got (optional)"
                  value={f.compQuote}
                  onChange={setF("compQuote")}
                  adornment="$"
                  placeholder="4,800"
                  inputMode="decimal"
                  hint="We'll beat it. Attach the paperwork below if you have it."
                />
              </div>
              <div className="qf-grid-2">
                <label
                  className="qf-file"
                  style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}
                >
                  <span style={fileLabelText}>Photos or video of the job</span>
                  <span className="qf-file__drop" style={fileDropText}>
                    {photoLabel}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) =>
                      setJob((prev) => ({
                        ...prev,
                        photos: Array.from(e.target.files ?? []).map((x) => x.name),
                      }))
                    }
                    style={hiddenFileInput}
                  />
                </label>
                <label
                  className="qf-file"
                  style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}
                >
                  <span style={fileLabelText}>Competitor quote (optional)</span>
                  <span className="qf-file__drop" style={fileDropText}>
                    {compFileLabel}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setJob((prev) => ({
                        ...prev,
                        compFile: e.target.files?.[0] ? e.target.files[0].name : "",
                      }))
                    }
                    style={hiddenFileInput}
                  />
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <Button variant="primary" size="lg" onClick={toStep2}>
                  Send the details
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card eyebrow="HOW THIS WORKS" title="Numbers first, then Eric">
                <p
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,.68)",
                    margin: 0,
                  }}
                >
                  The estimator reads your description and drafts a task list, crew size,
                  hours and a dollar range. Eric checks every number before it becomes a
                  quote. You commit to nothing by sending this.
                </p>
              </Card>
              <Card eyebrow="THE STANDING OFFER" title="We beat quotes" rule={false}>
                <p
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,.68)",
                    margin: 0,
                  }}
                >
                  Quotes are free. Put the other shop&apos;s number in the box and ours
                  comes in under it.
                </p>
              </Card>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div
            className="qf-pad"
            style={{
              maxWidth: 640,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              ...panelChamfer,
            }}
          >
            <div>
              <div style={stepKicker}>Step 2 of 4</div>
              <h2
                className="qf-h2 qf-focus-target"
                style={h2Style}
                tabIndex={-1}
                ref={step2HeadingRef}
              >
                Where do we send the numbers
              </h2>
            </div>
            <div className="qf-grid-2">
              <Input
                label="Name"
                id="qf-name"
                required
                value={c.name}
                onChange={setC("name")}
                autoComplete="name"
                error={errs.name || ""}
              />
              <Input
                label="Company (optional)"
                value={c.company}
                onChange={setC("company")}
                autoComplete="organization"
              />
            </div>
            <div className="qf-grid-2">
              <Input
                label="Phone"
                id="qf-phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={c.phone}
                onChange={setC("phone")}
                placeholder="(817) 555-0100"
                error={errs.phone || ""}
              />
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={c.email}
                onChange={setC("email")}
                placeholder="you@company.com"
              />
            </div>
            {TURNSTILE_SITE_KEY ? (
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                options={{ theme: "dark" }}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                onError={() => setTurnstileToken("")}
              />
            ) : null}
            <div className="qf-actions">
              <Button variant="ghost" onClick={backTo1}>
                Back to the job
              </Button>
              <Button variant="primary" size="lg" onClick={toStep3}>
                Run the estimate
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="qf-grid-main">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* 4.1.3: persistent live region announces the busy→ready swap. */}
              <div role="status" style={srOnly}>
                {estBusy ? "Drafting your numbers." : estReady ? "Estimate ready." : ""}
              </div>
              {estBusy ? (
                <div
                  className="qf-focus-target"
                  tabIndex={-1}
                  ref={draftingPanelRef}
                  style={{
                    background: "#0d0e0f",
                    border: "1px solid rgba(255,255,255,.1)",
                    padding: "48px 32px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: 900,
                      fontStyle: "oblique 10deg",
                      fontSize: 32,
                      textTransform: "uppercase",
                      color: "#ffffff",
                    }}
                  >
                    Drafting your numbers
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "#ffb020",
                    }}
                  >
                    Reading the job · sizing the crew · counting hours
                  </div>
                  <div className="qf-sweep-track">
                    <div className="qf-sweep" />
                  </div>
                </div>
              ) : null}

              {estReady && est ? (
                <>
                  <div
                    className="qf-pad"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                      ...panelChamfer,
                    }}
                  >
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
                        <div style={stepKicker}>Working estimate · {reqId}</div>
                        <h2
                          className="qf-h2 qf-focus-target"
                          style={h2Style}
                          tabIndex={-1}
                          ref={estHeadingRef}
                        >
                          {est.title}
                        </h2>
                      </div>
                      <Badge variant="warn" dot>
                        AI draft — not a final quote
                      </Badge>
                    </div>
                    <p
                      style={{
                        fontFamily: BODY,
                        fontSize: 15,
                        lineHeight: 1.55,
                        color: "rgba(255,255,255,.78)",
                        margin: 0,
                      }}
                    >
                      {est.summary}
                    </p>
                    <div style={{ border: "1px solid rgba(255,255,255,.1)" }}>
                      <div
                        className="qf-li-row"
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid rgba(255,255,255,.1)",
                          fontFamily: MONO,
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,.5)",
                          background: "#101214",
                        }}
                      >
                        <span>Task</span>
                        <span style={{ textAlign: "right" }}>Crew</span>
                        <span style={{ textAlign: "right" }}>Hours</span>
                      </div>
                      {est.line_items.map((li, i) => (
                        <div
                          key={i}
                          className="qf-li-row"
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                            fontFamily: BODY,
                            fontSize: 14,
                            color: "rgba(255,255,255,.82)",
                          }}
                        >
                          <span>{li.task}</span>
                          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13 }}>
                            {li.crew}
                          </span>
                          <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 13 }}>
                            {li.hours}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          padding: "14px 16px",
                          background: "#101214",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,.6)",
                          }}
                        >
                          Total man-hours {est.hours_low}–{est.hours_high}
                        </span>
                        {est.dollarsWithheld ||
                        est.dollars_low === undefined ||
                        est.dollars_high === undefined ? (
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 12,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              color: "#ffb020",
                              textAlign: "right",
                            }}
                          >
                            Eric sets the number on the call
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: DISPLAY,
                              fontWeight: 900,
                              fontStyle: "oblique 10deg",
                              fontSize: 32,
                              color: "#ffffff",
                            }}
                          >
                            {fmt(est.dollars_low)} – {fmt(est.dollars_high)}
                          </span>
                        )}
                      </div>
                    </div>
                    {est.dollarsWithheld ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          border: "1px solid rgba(255,176,32,.4)",
                          background: "rgba(255,176,32,.04)",
                          padding: "14px 16px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: BODY,
                            fontSize: 14,
                            lineHeight: 1.55,
                            color: "rgba(255,255,255,.82)",
                          }}
                        >
                          We estimate {est.hours_low}–{est.hours_high} hours of
                          work. We need more details before we put a number on
                          it. Eric will firm it up on the call.
                        </span>
                        <a
                          href="tel:8178946357"
                          style={{
                            fontFamily: MONO,
                            fontSize: 12,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "#ffffff",
                            textDecoration: "none",
                            border: "1px solid rgba(255,255,255,.2)",
                            padding: "8px 12px",
                            alignSelf: "flex-start",
                          }}
                        >
                          Call Eric: (817) 894-6357
                        </a>
                      </div>
                    ) : null}
                    {f.compQuote ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          border: "1px solid rgba(201,3,20,.5)",
                          padding: "14px 16px",
                        }}
                      >
                        <Icon name="file-text" size={18} color="#c90314" />
                        <span
                          style={{
                            fontFamily: BODY,
                            fontSize: 14,
                            color: "rgba(255,255,255,.82)",
                          }}
                        >
                          You told us the other bid was ${f.compQuote}. Eric&apos;s final
                          quote comes in under it.
                        </span>
                      </div>
                    ) : null}
                    {est.questions && est.questions.length ? (
                      <div>
                        <div
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,.5)",
                            marginBottom: 10,
                          }}
                        >
                          Eric will ask about
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {est.questions.map((q) => (
                            <div
                              key={q}
                              style={{
                                display: "flex",
                                gap: 10,
                                fontFamily: BODY,
                                fontSize: 14,
                                color: "rgba(255,255,255,.72)",
                              }}
                            >
                              <span style={{ color: "#c90314" }} aria-hidden="true">
                                ◆
                              </span>
                              <span>{q}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div
                      style={{
                        border: "1px solid rgba(255,176,32,.4)",
                        background: "rgba(255,176,32,.04)",
                        padding: "12px 14px",
                        fontFamily: BODY,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "rgba(255,255,255,.75)",
                      }}
                    >
                      An AI drafted these numbers from your description. They are not the
                      final quote and can change once Eric sees the job. He confirms every
                      number before work starts.
                    </div>
                  </div>

                  <div
                    className="qf-pad"
                    style={{
                      background: "#0d0e0f",
                      border: "1px solid rgba(255,255,255,.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: DISPLAY,
                        fontWeight: 900,
                        fontStyle: "oblique 10deg",
                        fontSize: 28,
                        textTransform: "uppercase",
                        color: "#ffffff",
                        margin: 0,
                      }}
                    >
                      Pick a callback slot
                    </h3>
                    <div className="qf-slots">
                      {slots.map((sl) => {
                        const active = slot === sl.label;
                        return (
                          <button
                            key={sl.label}
                            type="button"
                            className="qf-slot"
                            aria-pressed={active}
                            onClick={() => setSlot(sl.label)}
                            style={
                              {
                                "--qf-slot-border": active
                                  ? "#c90314"
                                  : "rgba(255,255,255,.14)",
                                "--qf-slot-bg": active
                                  ? "linear-gradient(180deg, #e2101f 0%, #a00210 100%)"
                                  : "#101214",
                              } as CSSProperties
                            }
                          >
                            <span
                              style={{
                                fontFamily: MONO,
                                fontSize: 10,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: active ? "#ffffff" : "rgba(255,255,255,.6)",
                              }}
                            >
                              {sl.day}
                            </span>
                            <span
                              style={{
                                fontFamily: DISPLAY,
                                fontWeight: 900,
                                fontStyle: "oblique 10deg",
                                fontSize: 18,
                                lineHeight: 1,
                              }}
                            >
                              {sl.time}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="qf-actions">
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,.5)",
                        }}
                      >
                        {slot ? "Slot: " + slot : "Pick a window for the callback."}
                      </span>
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!slot || submitting}
                        onClick={() => void submit()}
                      >
                        Send the request
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card eyebrow="YOUR JOB" title={f.type || "Your job"}>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,.72)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    textTransform: "uppercase",
                  }}
                >
                  <span>MATERIAL · {f.material || "TBD"}</span>
                  <span>TIMELINE · {f.timeline || "Flexible"}</span>
                  <span>LOCATION · {f.location || "TBD"}</span>
                  <span>PHOTOS · {f.photos.length}</span>
                </div>
              </Card>
              <div>
                <Button variant="ghost" onClick={backTo1}>
                  Edit the job
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div
            style={{
              maxWidth: 720,
              background: "#0d0e0f",
              border: "1px solid rgba(255,255,255,.1)",
              clipPath:
                "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
            }}
          >
            <HazardBar variant="red" height="6px" />
            <div
              className="qf-pad-lg"
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="circle-check" size={28} color="#3ec96a" strokeWidth={2.5} />
                <h2
                  className="qf-h2-lg qf-focus-target"
                  style={{ ...h2Style, margin: 0 }}
                  tabIndex={-1}
                  ref={step4HeadingRef}
                >
                  Request sent.
                </h2>
              </div>
              <p
                style={{
                  fontFamily: BODY,
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.82)",
                  margin: 0,
                }}
              >
                Eric will call you back within the hour at your slot: {slot}. Your
                reference is {reqId}. The AI draft you saw is a starting point, not the
                final quote. Eric sets the real number on the call.
              </p>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.5)",
                }}
              >
                A copy went to eric@tidwellwelding.com. Check your email for the recap.
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                <Button variant="secondary" href="/">
                  Back to the site
                </Button>
                <Button variant="ghost" href="/work">
                  See the work
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
