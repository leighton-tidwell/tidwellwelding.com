"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useConvex } from "convex/react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Button,
  Card,
  HazardBar,
  Icon,
  Input,
  Select,
} from "@/components/ds";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/business";
import { getSessionId } from "@/lib/session";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
// Runtime-pure helper (its only convex import is a type), so the browser
// bundle gets the same email rule the server enforces.
import { isEmail } from "../../../../convex/emailTemplates";
import { fallbackDraft } from "../../../../convex/estimateFallback";
import {
  CNC_TYPE,
  COMPETITOR_ACCEPT,
  MAX_UPLOAD_FILES,
  rejectCompetitorFile,
  rejectFile,
  uploadAccept,
} from "../../../../convex/uploadRules";

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
  thickness: string;
  quantity: string;
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
  CNC_TYPE,
];

const MATERIAL_OPTIONS = [
  "Carbon steel",
  "Stainless",
  "Aluminum",
  "Inconel",
  "Chrome-moly",
  "Not sure",
];

/** Step-1 copy and field visibility per job type. CNC is shop work cut from
 * a drawing, so it asks fewer, different questions. */
type JobForm = {
  hidden: (keyof JobFields)[];
  materials: string[];
  descLabel: string;
  descPlaceholder: string;
  descHint: string;
  dimsLabel: string;
  dimsPlaceholder: string;
  uploadLabel: string;
  uploadEmpty: string;
  uploadCountLabel: string;
};

const DEFAULT_FORM: JobForm = {
  hidden: ["thickness", "quantity"],
  materials: MATERIAL_OPTIONS,
  descLabel: "What needs welding or building",
  descPlaceholder:
    "Cracked bucket ear on a 320 excavator. Crack runs about 8 in along the pin boss.",
  descHint: "Sizes, counts and what broke. Write it like a text message.",
  dimsLabel: "Rough dimensions",
  dimsPlaceholder: "8 in crack · 3/4 in plate",
  uploadLabel: "Photos of the job",
  uploadEmpty: "Tap to attach. Two angles beat ten words.",
  uploadCountLabel: "PHOTOS",
};

const CNC_FORM: JobForm = {
  hidden: ["location", "compQuote", "compFile"],
  materials: ["Carbon steel", "Stainless", "Aluminum"],
  descLabel: "What do you need cut?",
  descPlaceholder: "Ranch entry sign with our brand in the middle.",
  descHint:
    "For a sign, give the words and the logo. For a part, the shape and holes.",
  dimsLabel: "Size",
  dimsPlaceholder: "6 ft x 2 ft",
  uploadLabel: "Drawing, DXF/CAD file or photo",
  uploadEmpty: "Tap to attach. DXF, DWG, SVG, PDF, AI, EPS or a photo.",
  uploadCountLabel: "FILES",
};

const jobFormFor = (type: string): JobForm =>
  type === CNC_TYPE ? CNC_FORM : DEFAULT_FORM;

/** Job fields as the backend takes them. Fields the form hides for this job
 * type never leave the browser, even if typed before the type changed. */
function jobArgs(f: JobFields) {
  const form = jobFormFor(f.type);
  const shown = (k: keyof JobFields, value: string) =>
    form.hidden.includes(k) ? undefined : value || undefined;
  return {
    type: f.type,
    material: form.materials.includes(f.material) ? f.material : undefined,
    desc: f.desc,
    dims: f.dims || undefined,
    thickness: shown("thickness", f.thickness),
    quantity: shown("quantity", f.quantity),
    timeline: f.timeline || undefined,
    location: shown("location", f.location),
    compQuote: shown("compQuote", f.compQuote),
    photoNames: f.photos.length ? f.photos : undefined,
  };
}

/** "Your job" lines on the estimate step, filtered by the same form config. */
function jobSummary(f: JobFields): string[] {
  const form = jobFormFor(f.type);
  const given = (k: keyof JobFields, label: string, value: string) =>
    !form.hidden.includes(k) && value ? [`${label} · ${value}`] : [];
  return [
    `MATERIAL · ${(form.materials.includes(f.material) && f.material) || "TBD"}`,
    ...given("thickness", "THICKNESS", f.thickness),
    ...given("quantity", "QUANTITY", f.quantity),
    `TIMELINE · ${f.timeline || "Flexible"}`,
    ...(form.hidden.includes("location")
      ? []
      : [`LOCATION · ${f.location || "TBD"}`]),
    `${form.uploadCountLabel} · ${f.photos.length}`,
  ];
}

const TIMELINE_OPTIONS = [
  "Emergency. Right now.",
  "This week",
  "Next two weeks",
  "Flexible",
];

/**
 * Server caps mirrored on the client so the visitor sees the limit on the
 * field instead of a rejected submission. Keep these in step with the
 * `rejectOversize` tables in convex/quotes.ts and convex/estimate.ts.
 * `location` takes the stricter of the two server caps (500 in
 * draftEstimate, 600 in submitQuote) so one value clears both endpoints.
 */
const MAX = {
  desc: 4000,
  name: 300,
  company: 300,
  phone: 100,
  email: 300,
  dims: 500,
  thickness: 100,
  quantity: 100,
  location: 500,
  compQuote: 100,
  photoName: 300,
} as const;

const tooLong = (max: number) =>
  `Keep this under ${max.toLocaleString("en-US")} characters.`;

/** Messages the form checks for itself. Worded exactly as the backend throws
 * them, so a server rejection that repeats one can be placed on its field. */
const MSG = {
  type: "Pick a job type.",
  desc: "Describe the job in a sentence or two.",
  name: "Enter your name.",
  phone: "Enter a 10-digit number.",
  email: "Enter a valid email or leave it blank.",
} as const;

/** message → field, inverted from MSG so there is one source for the pair.
 * This only decides *where* a failure is shown; every message reaches a
 * screen either way, so a message this build has never seen still displays. */
const FIELD_FOR_MESSAGE: Record<string, string> = Object.fromEntries(
  Object.entries(MSG).map(([field, message]) => [message, field]),
);

const VERIFY_PENDING =
  "Finish the verification check below, then run the estimate.";

const ESTIMATOR_UNREACHABLE =
  `We could not reach the estimator, so the numbers below are typical for this ` +
  `kind of job rather than a draft from your description. Eric sets the real ` +
  `number on the call.`;

const SUBMIT_FAILED =
  `We could not send your request, and nothing was saved. Try again, or call ` +
  `Eric and he will take the details.`;

/**
 * The customer-ready message a ConvexError carries, or null for anything
 * else (a network failure, a thrown Error). Convex puts an application
 * error's payload on `data`; every ConvexError the backend throws carries a
 * plain string written to be shown to the visitor.
 */
function convexErrorMessage(err: unknown): string | null {
  const data = (err as { data?: unknown } | null | undefined)?.data;
  if (typeof data === "string") return data.trim() || null;
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message.trim() || null;
  }
  return null;
}

/**
 * What to show the visitor for a failed call: the backend's own message when
 * it sent one, else `fallback`. `field` is set only when the message is one
 * the form also checks, so the field can be marked for the trip back to edit
 * it; everything else shows as a step-level message, which is the default.
 */
function failureMessage(
  err: unknown,
  fallback: string,
): { message: string; field?: string } {
  const message = convexErrorMessage(err);
  if (!message) return { message: fallback };
  return { message, field: FIELD_FOR_MESSAGE[message] };
}

/** Backend unreachable: the same draft the server falls back to, dollars
 * withheld. */
const fallbackEstimate = (jobType: string): Estimate => ({
  ...fallbackDraft(jobType),
  dollarsWithheld: true,
});

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
    out.push({ label: `${day} · Morning`, day, time: "8a–12p" });
    out.push({ label: `${day} · Afternoon`, day, time: "1p–5p" });
    added++;
  }
  return out;
}

function makeRequestId(): string {
  return (
    "Q-" +
    new Date().getFullYear() +
    "-" +
    String(Math.floor(100 + Math.random() * 900))
  );
}

const fmt = (n: number) => `$${Number(n || 0).toLocaleString("en-US")}`;

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

const fileErrorText: CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  color: "#ff6b6b",
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
  thickness: "qf-thickness",
  quantity: "qf-quantity",
  dims: "qf-dims",
  location: "qf-location",
  compQuote: "qf-comp-quote",
  name: "qf-name",
  company: "qf-company",
  phone: "qf-phone",
  email: "qf-email",
};

const stepAlert: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 10,
  border: "1px solid rgba(224,22,37,.55)",
  background: "rgba(224,22,37,.07)",
  padding: "14px 16px",
};

const callLink: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#ffffff",
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,.2)",
  padding: "8px 12px",
};

/**
 * A failure the visitor has to act on: the reason, verbatim, plus the phone
 * number so a dead end is still a lead. `tone="warn"` is the softer panel
 * used when the flow carried on anyway.
 */
function StepAlert({
  message,
  tone = "error",
  children,
}: {
  message: string;
  tone?: "error" | "warn";
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      style={
        tone === "warn"
          ? {
              ...stepAlert,
              border: "1px solid rgba(255,176,32,.4)",
              background: "rgba(255,176,32,.04)",
            }
          : stepAlert
      }
    >
      <span
        style={{
          fontFamily: BODY,
          fontSize: 14,
          lineHeight: 1.55,
          color: "rgba(255,255,255,.86)",
        }}
      >
        {message}
      </span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {children}
        <a href={PHONE_TEL} style={callLink}>
          Call Eric: {PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}

function focusFirstInvalid(order: string[], next: Record<string, string>) {
  const first = order.find((key) => next[key]);
  const id = first && ERR_FIELD_IDS[first];
  if (id) document.getElementById(id)?.focus();
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
    thickness: "",
    quantity: "",
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
  const [uploads, setUploads] = useState<File[]>([]);
  const [compUpload, setCompUpload] = useState<File | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [est, setEst] = useState<Estimate | null>(null);
  const [estBusy, setEstBusy] = useState(false);
  const [slot, setSlot] = useState("");
  const [reqId, setReqId] = useState(makeRequestId);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  /** Why the estimate call failed. With an estimate alongside it, the draft
   * is the static fallback and this says so; without one, nothing drafted. */
  const [estErr, setEstErr] = useState("");
  /** Set only when a submission did not persist. Step 4 never renders while
   * this is set. */
  const [submitErr, setSubmitErr] = useState("");
  /** Files whose upload failed on the submission that got through. The
   * request persisted with their names, so step 4 names them in a notice
   * rather than letting the visitor assume Eric has the files (issue #37). */
  const [notUploaded, setNotUploaded] = useState<string[]>([]);

  const slots = useMemo(() => makeSlots(), []);

  /**
   * Stable identity, and a no-op when there is nothing to clear: the widget
   * re-subscribes whenever this callback changes, so a fresh object from
   * either state setter here would re-render it, re-fire the success handler
   * and loop forever.
   */
  const onVerified = useCallback((token: string) => {
    setTurnstileToken(token);
    // Drops the "finish the check" notice once the check clears.
    setErrs((prev) => (prev.form ? { ...prev, form: "" } : prev));
  }, []);

  /** The widget mounts on step 2 and takes a few seconds to solve. Until it
   * hands over a token the server will reject the estimate, so the action
   * that spends it stays off. Without a site key there is no widget and the
   * deployment is in Turnstile dev mode, so nothing is pending. */
  const verifyPending = !!TURNSTILE_SITE_KEY && !turnstileToken;

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
    if (estBusy || (!est && !estErr)) return;
    const active = document.activeElement;
    if (!active || active === document.body) estHeadingRef.current?.focus();
  }, [est, estBusy, estErr]);

  const setF = (k: keyof JobFields) => (value: string) => {
    setJob((prev) => ({ ...prev, [k]: value }));
    setErrs((prev) => ({ ...prev, [k]: "" }));
  };
  const setC = (k: keyof ContactFields) => (value: string) => {
    setContact((prev) => ({ ...prev, [k]: value }));
    setErrs((prev) => ({ ...prev, [k]: "" }));
  };

  /** Switching job type drops attached files the new type does not take. */
  const setType = (type: string) => {
    setF("type")(type);
    const dropped = uploads.filter((file) => rejectFile(type, file));
    if (!dropped.length) return;
    const kept = uploads.filter((file) => !rejectFile(type, file));
    setUploads(kept);
    setJob((prev) => ({ ...prev, photos: kept.map((x) => x.name) }));
    setErrs((prev) => ({
      ...prev,
      photos: `Removed ${dropped.map((x) => x.name).join(", ")}. ${type.replace(/ \(.*\)$/, "")} jobs take photos only.`,
    }));
  };

  const toStep2 = () => {
    const next: Record<string, string> = {};
    const hidden = jobFormFor(f.type).hidden;
    /** Only fields this job type actually sends are worth checking. */
    const cap = (k: keyof JobFields & keyof typeof MAX, value: string) => {
      if (!hidden.includes(k) && value.length > MAX[k]) {
        next[k] = tooLong(MAX[k]);
      }
    };
    if (!f.type) next.type = MSG.type;
    if (!f.desc.trim()) next.desc = MSG.desc;
    else cap("desc", f.desc);
    cap("thickness", f.thickness);
    cap("quantity", f.quantity);
    cap("dims", f.dims);
    cap("location", f.location);
    cap("compQuote", f.compQuote);
    if (Object.keys(next).length) {
      setErrs(next);
      focusFirstInvalid(
        [
          "type",
          "desc",
          "thickness",
          "quantity",
          "dims",
          "location",
          "compQuote",
        ],
        next,
      );
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const runEstimate = async () => {
    setEstBusy(true);
    setEst(null);
    setEstErr("");
    setSubmitErr("");
    const started = Date.now();
    let result: Estimate | null = null;
    let failure = "";
    try {
      if (!convex) throw new Error("Convex client unavailable");
      result = await convex.action(api.estimate.draftEstimate, {
        ...jobArgs(f),
        sessionId: getSessionId(),
        // No token means the widget has not cleared, and the server is right
        // to reject it. Never substitute a placeholder.
        turnstileToken: turnstileToken || undefined,
      });
    } catch (err) {
      const { message, field } = failureMessage(err, "");
      if (message) {
        // The backend rejected the request and said why. Show that reason
        // rather than a draft that implies the request went through, and
        // mark the field it names for the trip back to edit it.
        failure = message;
        if (field) setErrs((prev) => ({ ...prev, [field]: message }));
      } else {
        // No customer-ready reason: the estimator was unreachable. The static
        // draft still gives hours with the dollars withheld, but say plainly
        // that it did not come from this job description.
        result = fallbackEstimate(f.type);
        failure = ESTIMATOR_UNREACHABLE;
      }
    }
    // Keep the drafting panel visible long enough to read when the
    // fallback answers instantly.
    const elapsed = Date.now() - started;
    if (elapsed < 700) {
      await new Promise((resolve) => setTimeout(resolve, 700 - elapsed));
    }
    setEst(result);
    setEstErr(failure);
    setEstBusy(false);
  };

  const toStep3 = () => {
    const next: Record<string, string> = {};
    if (!c.name.trim()) next.name = MSG.name;
    else if (c.name.length > MAX.name) next.name = tooLong(MAX.name);
    if (c.company.length > MAX.company) next.company = tooLong(MAX.company);
    if (c.phone.replace(/\D/g, "").length !== 10) next.phone = MSG.phone;
    else if (c.phone.length > MAX.phone) next.phone = tooLong(MAX.phone);
    if (c.email.trim()) {
      if (c.email.length > MAX.email) next.email = tooLong(MAX.email);
      else if (!isEmail(c.email.trim())) next.email = MSG.email;
    }
    // The button is disabled while the check is pending; this also catches a
    // token that expired between the last render and the click.
    if (verifyPending) next.form = VERIFY_PENDING;
    if (Object.keys(next).length) {
      setErrs(next);
      focusFirstInvalid(["name", "company", "phone", "email"], next);
      return;
    }
    setStep(3);
    window.scrollTo(0, 0);
    void runEstimate();
  };

  const backTo1 = () => setStep(1);

  /** Keep the picks that fit this job type; say why the rest were dropped. */
  const pickFiles = (picked: File[]) => {
    const problems = picked
      .map((file) => rejectFile(f.type, file))
      .filter((p): p is string => !!p);
    let kept = picked.filter((file) => !rejectFile(f.type, file));
    // The server rejects the whole request over a long file name, so drop
    // those here with the reason.
    if (kept.some((file) => file.name.length > MAX.photoName)) {
      problems.push(
        `Rename files with names over ${MAX.photoName} characters before attaching them.`,
      );
      kept = kept.filter((file) => file.name.length <= MAX.photoName);
    }
    if (kept.length > MAX_UPLOAD_FILES) {
      problems.push(`Send ${MAX_UPLOAD_FILES} files or fewer.`);
      kept = kept.slice(0, MAX_UPLOAD_FILES);
    }
    setUploads(kept);
    setJob((prev) => ({ ...prev, photos: kept.map((x) => x.name) }));
    setErrs((prev) => ({ ...prev, photos: problems.join(" ") }));
  };

  /** Keep the competitor quote if it is a photo or PDF under its cap. */
  const pickCompFile = (file: File | undefined) => {
    const problem = file ? rejectCompetitorFile(file) : null;
    const kept = file && !problem ? file : null;
    setCompUpload(kept);
    setJob((prev) => ({ ...prev, compFile: kept?.name ?? "" }));
    setErrs((prev) => ({ ...prev, compFile: problem ?? "" }));
  };

  /** Push each picked file to Convex storage. Files that fail (or no longer
   * fit after a job type change) fall back to name-only. The competitor
   * quote rides along marked as such, unless this job type hides it. */
  const uploadFiles = async () => {
    const sent: {
      storageId: Id<"_storage">;
      name: string;
      kind?: "competitor";
    }[] = [];
    const notSent: string[] = [];
    const picks = uploads.map((file) => ({
      file,
      problem: rejectFile(f.type, file),
      kind: undefined as "competitor" | undefined,
    }));
    if (compUpload && !jobFormFor(f.type).hidden.includes("compFile")) {
      picks.push({
        file: compUpload,
        problem: rejectCompetitorFile(compUpload),
        kind: "competitor",
      });
    }
    for (const { file, problem, kind } of picks) {
      try {
        if (!convex || problem) throw new Error("skip");
        const url = await convex.mutation(api.uploads.generateUploadUrl, {
          sessionId: getSessionId(),
        });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error("upload failed");
        const { storageId } = (await res.json()) as {
          storageId: Id<"_storage">;
        };
        sent.push({ storageId, name: file.name, ...(kind ? { kind } : {}) });
      } catch {
        notSent.push(file.name);
      }
    }
    return { sent, notSent };
  };

  const submit = async () => {
    if (!slot || submitting) return;
    setSubmitting(true);
    setSubmitErr("");
    let finalId = reqId;
    const { sent, notSent } = await uploadFiles();
    try {
      if (!convex) throw new Error("Convex client unavailable");
      const res = await convex.action(api.quotes.submitQuote, {
        requestId: reqId,
        name: c.name,
        company: c.company || undefined,
        phone: c.phone,
        email: c.email || undefined,
        job: {
          ...jobArgs(f),
          photoNames: notSent.length ? notSent : undefined,
        },
        files: sent.length ? sent : undefined,
        estimate: est ?? undefined,
        slot,
        sessionId: getSessionId(),
        // Either a fresh token or the session the estimate step verified.
        turnstileToken: turnstileToken || undefined,
      });
      if (res?.requestId) finalId = res.requestId;
    } catch (err) {
      // Nothing persisted and no email reached Eric. The confirmation screen
      // would be a lie, so stay on step 3 with the reason, a retry and the
      // phone number.
      const { message, field } = failureMessage(err, SUBMIT_FAILED);
      if (field) setErrs((prev) => ({ ...prev, [field]: message }));
      setSubmitErr(message);
      setSubmitting(false);
      return;
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
    setNotUploaded(notSent);
    setSubmitting(false);
    setStep(4);
    window.scrollTo(0, 0);
  };

  const form = jobFormFor(f.type);
  const shows = (k: keyof JobFields) => !form.hidden.includes(k);
  const isEmergency =
    f.timeline === "Emergency. Right now." || f.type === "Emergency";
  const estReady = !!est && !estBusy;
  const photoLabel = f.photos.length
    ? `${f.photos.length} file(s): ${f.photos.join(", ")}`
    : form.uploadEmpty;
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
          Describe the job. Get working{" "}
          <span style={{ color: "#c90314" }}>numbers</span>.
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
                {`0${i + 1}`}
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
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
                ...panelChamfer,
              }}
            >
              <div className="qf-grid-2">
                <Select
                  label="Job type"
                  id="qf-type"
                  required
                  value={f.type}
                  onChange={setType}
                  options={TYPE_OPTIONS}
                  placeholder="Pick one"
                  error={errs.type || ""}
                />
                <Select
                  label="Material"
                  value={f.material}
                  onChange={setF("material")}
                  options={form.materials}
                  placeholder="If you know it"
                />
              </div>
              <Input
                label={form.descLabel}
                id="qf-desc"
                required
                multiline
                rows={4}
                value={f.desc}
                onChange={setF("desc")}
                placeholder={form.descPlaceholder}
                hint={form.descHint}
                maxLength={MAX.desc}
                error={errs.desc || ""}
              />
              {shows("thickness") ? (
                <div className="qf-grid-2">
                  <Input
                    label="Thickness"
                    id="qf-thickness"
                    value={f.thickness}
                    onChange={setF("thickness")}
                    placeholder='1/4"'
                    maxLength={MAX.thickness}
                    error={errs.thickness || ""}
                  />
                  <Input
                    label="Quantity"
                    id="qf-quantity"
                    value={f.quantity}
                    onChange={setF("quantity")}
                    placeholder="1"
                    inputMode="numeric"
                    maxLength={MAX.quantity}
                    error={errs.quantity || ""}
                  />
                </div>
              ) : null}
              <div className="qf-grid-2">
                <Input
                  label={form.dimsLabel}
                  id="qf-dims"
                  value={f.dims}
                  onChange={setF("dims")}
                  placeholder={form.dimsPlaceholder}
                  maxLength={MAX.dims}
                  error={errs.dims || ""}
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
                    background:
                      "linear-gradient(180deg, #e2101f 0%, #a00210 100%)",
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
              {shows("location") ? (
                <div className="qf-grid-2">
                  <Input
                    label="Where the work sits"
                    id="qf-location"
                    value={f.location}
                    onChange={setF("location")}
                    placeholder="Shop drop-off, or an address / town"
                    hint="Site access notes help: gates, power, overhead lines."
                    maxLength={MAX.location}
                    error={errs.location || ""}
                  />
                  <Input
                    label="Quote you already got (optional)"
                    id="qf-comp-quote"
                    value={f.compQuote}
                    onChange={setF("compQuote")}
                    adornment="$"
                    placeholder="4,800"
                    inputMode="decimal"
                    hint="We'll beat it. Attach the paperwork below if you have it."
                    maxLength={MAX.compQuote}
                    error={errs.compQuote || ""}
                  />
                </div>
              ) : null}
              <div className="qf-grid-2">
                <label
                  className="qf-file"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <span style={fileLabelText}>{form.uploadLabel}</span>
                  <span className="qf-file__drop" style={fileDropText}>
                    {photoLabel}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={uploadAccept(f.type)}
                    onChange={(e) =>
                      pickFiles(Array.from(e.target.files ?? []))
                    }
                    style={hiddenFileInput}
                  />
                  {errs.photos ? (
                    <span role="alert" style={fileErrorText}>
                      {errs.photos}
                    </span>
                  ) : null}
                </label>
                {shows("compFile") ? (
                  <label
                    className="qf-file"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <span style={fileLabelText}>
                      Competitor quote (optional)
                    </span>
                    <span className="qf-file__drop" style={fileDropText}>
                      {compFileLabel}
                    </span>
                    <input
                      type="file"
                      accept={COMPETITOR_ACCEPT}
                      onChange={(e) => pickCompFile(e.target.files?.[0])}
                      style={hiddenFileInput}
                    />
                    {errs.compFile ? (
                      <span role="alert" style={fileErrorText}>
                        {errs.compFile}
                      </span>
                    ) : null}
                  </label>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
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
                  The estimator reads your description and drafts a task list,
                  crew size, hours and a dollar range. Eric checks every number
                  before it becomes a quote. You commit to nothing by sending
                  this.
                </p>
              </Card>
              {shows("compQuote") ? (
                <Card
                  eyebrow="THE STANDING OFFER"
                  title="We beat quotes"
                  rule={false}
                >
                  <p
                    style={{
                      fontFamily: BODY,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,.68)",
                      margin: 0,
                    }}
                  >
                    Quotes are free. Put the other shop&apos;s number in the box
                    and ours comes in under it.
                  </p>
                </Card>
              ) : null}
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
                maxLength={MAX.name}
                error={errs.name || ""}
              />
              <Input
                label="Company (optional)"
                id="qf-company"
                value={c.company}
                onChange={setC("company")}
                autoComplete="organization"
                maxLength={MAX.company}
                error={errs.company || ""}
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
                maxLength={MAX.phone}
                error={errs.phone || ""}
              />
              <Input
                label="Email"
                id="qf-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={c.email}
                onChange={setC("email")}
                placeholder="you@company.com"
                maxLength={MAX.email}
                error={errs.email || ""}
              />
            </div>
            {TURNSTILE_SITE_KEY ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <Turnstile
                  siteKey={TURNSTILE_SITE_KEY}
                  options={{ theme: "dark" }}
                  onSuccess={onVerified}
                  onExpire={() => setTurnstileToken("")}
                  onError={() => setTurnstileToken("")}
                />
                {/* Says why the button is off; announced when it turns on. */}
                <span
                  role="status"
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: verifyPending ? "#ffb020" : "rgba(255,255,255,.5)",
                  }}
                >
                  {verifyPending
                    ? "Running a quick check that you are human. The button turns on when it clears."
                    : "Check cleared. Ready to run the estimate."}
                </span>
              </div>
            ) : null}
            {errs.form ? <StepAlert message={errs.form} /> : null}
            <div className="qf-actions">
              <Button variant="ghost" onClick={backTo1}>
                Back to the job
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={verifyPending}
                onClick={toStep3}
              >
                {verifyPending ? "Waiting on the check" : "Run the estimate"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="qf-grid-main">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* 4.1.3: persistent live region announces the busy→ready swap. */}
              <div role="status" style={srOnly}>
                {estBusy
                  ? "Drafting your numbers."
                  : estReady
                    ? "Estimate ready."
                    : estErr
                      ? "We could not draft the numbers."
                      : ""}
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

              {/* The estimate failed outright: no draft, and the reason the
                  backend gave, verbatim. The flow stops here rather than
                  carrying on to a request that would be rejected too. */}
              {!estBusy && !est && estErr ? (
                <div
                  className="qf-pad"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    ...panelChamfer,
                  }}
                >
                  <div>
                    <div style={stepKicker}>Step 3 of 4 · {reqId}</div>
                    <h2
                      className="qf-h2 qf-focus-target"
                      style={h2Style}
                      tabIndex={-1}
                      ref={estHeadingRef}
                    >
                      We could not draft the numbers
                    </h2>
                  </div>
                  <StepAlert message={estErr}>
                    <Button
                      variant="secondary"
                      onClick={() => void runEstimate()}
                    >
                      Try the estimate again
                    </Button>
                  </StepAlert>
                </div>
              ) : null}

              {estReady && est ? (
                <>
                  {/* Static draft stood in for the estimator. Say so above the
                      numbers instead of passing them off as a draft of this
                      job. */}
                  {estErr ? <StepAlert message={estErr} tone="warn" /> : null}
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
                          // biome-ignore lint/suspicious/noArrayIndexKey: estimate lines are replaced wholesale, never reordered.
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
                          <span
                            style={{
                              textAlign: "right",
                              fontFamily: MONO,
                              fontSize: 13,
                            }}
                          >
                            {li.crew}
                          </span>
                          <span
                            style={{
                              textAlign: "right",
                              fontFamily: MONO,
                              fontSize: 13,
                            }}
                          >
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
                    {shows("compQuote") && f.compQuote ? (
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
                          You told us the other bid was ${f.compQuote}.
                          Eric&apos;s final quote comes in under it.
                        </span>
                      </div>
                    ) : null}
                    {est.questions?.length ? (
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
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
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
                              <span
                                style={{ color: "#c90314" }}
                                aria-hidden="true"
                              >
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
                      An AI drafted these numbers from your description. They
                      are not the final quote and can change once Eric sees the
                      job. He confirms every number before work starts.
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
                                color: active
                                  ? "#ffffff"
                                  : "rgba(255,255,255,.6)",
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
                    {/* The submission did not persist. Retry from here; the
                        confirmation screen stays unreachable until one does. */}
                    {submitErr ? <StepAlert message={submitErr} /> : null}
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
                        {slot
                          ? `Slot: ${slot}`
                          : "Pick a window for the callback."}
                      </span>
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!slot || submitting}
                        onClick={() => void submit()}
                      >
                        {submitErr ? "Try sending again" : "Send the request"}
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
                  {jobSummary(f).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
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
                <Icon
                  name="circle-check"
                  size={28}
                  color="#3ec96a"
                  strokeWidth={2.5}
                />
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
                Eric will call you back within the hour at your slot: {slot}.
                Your reference is {reqId}. The AI draft you saw is a starting
                point, not the final quote. Eric sets the real number on the
                call.
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
                A copy went to eric@tidwellwelding.com. Check your email for the
                recap.
              </div>
              {notUploaded.length ? (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 14,
                    background: "rgba(255,176,32,.08)",
                    border: "1px solid rgba(255,176,32,.35)",
                  }}
                >
                  <Icon
                    name="triangle-alert"
                    size={20}
                    color="#ffb020"
                    strokeWidth={2.5}
                  />
                  <p
                    style={{
                      fontFamily: BODY,
                      fontSize: 15,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,.82)",
                      margin: 0,
                    }}
                  >
                    These files did not finish uploading:{" "}
                    {notUploaded.join(", ")}. Eric has your request and the file
                    names, and he will ask for them on the call. To send them
                    sooner, call{" "}
                    <a href={PHONE_TEL} style={{ color: "#ffb020" }}>
                      {PHONE_DISPLAY}
                    </a>
                    .
                  </p>
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
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
