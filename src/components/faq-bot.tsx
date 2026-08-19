"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import { useConvex } from "convex/react";
import { ConvexError } from "convex/values";
import {
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import HazardBar from "@/components/ds/hazard-bar";
import Icon from "@/components/ds/icon";
import { getSessionId } from "@/lib/session";

const MAX_INPUT_CHARS = 500;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const FALLBACK_TEXT =
  "Can't reach the assistant right now. Call or email Eric direct — he answers.";

const GREETING =
  "Ask about the service area, pricing, materials, turnaround, or emergency response. If it needs Eric, I'll put you straight through to him.";

type Msg = {
  role: "user" | "bot";
  text: string;
  contact: boolean;
};

/**
 * "Ask the shop" floating FAQ chat (FaqBot.dc.html). Rendered from the
 * (site) layout on every public page; hides itself on /quote. /crew sits
 * outside the (site) group and never renders it. Backed by convex/chat.ts
 * (startThread + sendMessage); shows the fallback message and contact CTAs
 * whenever the backend is unreachable — including when NEXT_PUBLIC_CONVEX_URL
 * is unset — so it never crashes the page.
 */
export default function FaqBot() {
  const pathname = usePathname();
  // useConvex is a plain context read: undefined when ConvexClientProvider
  // rendered without a client (NEXT_PUBLIC_CONVEX_URL unset).
  const convex = useConvex();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "bot", text: GREETING, contact: false },
  ]);

  const threadRef = useRef<Id<"chatThreads"> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);

  // Invisible Turnstile: mounted with the panel, executed on the first send.
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const tokenRef = useRef("");
  const tokenWaiters = useRef<Array<(t: string) => void>>([]);
  const executedRef = useRef(false);

  const resolveToken = (t: string) => {
    tokenRef.current = t;
    const waiters = tokenWaiters.current;
    tokenWaiters.current = [];
    for (const resolve of waiters) resolve(t);
  };

  /** Token for the first message of a session; executes the widget on demand. */
  const getToken = (): Promise<string> => {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve("dev");
    if (tokenRef.current) return Promise.resolve(tokenRef.current);
    return new Promise<string>((resolve) => {
      tokenWaiters.current.push(resolve);
      if (!executedRef.current) {
        executedRef.current = true;
        turnstileRef.current?.execute();
      }
      // Never hang the send on a stuck challenge; the backend answers honestly.
      window.setTimeout(() => resolve(tokenRef.current), 12000);
    });
  };

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      // Widget remounts with the panel; allow a fresh execute.
      executedRef.current = false;
    }
  }, [open]);

  if (pathname?.startsWith("/quote") || pathname?.startsWith("/crew")) {
    return null;
  }

  const send = async () => {
    const q = input.trim().slice(0, MAX_INPUT_CHARS);
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q, contact: false }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      if (!convex) throw new Error("Convex client unavailable");
      const sessionId = getSessionId();
      const turnstileToken = await getToken();
      if (!threadRef.current) {
        threadRef.current = await convex.mutation(api.chat.startThread, {
          sessionId,
        });
      }
      const reply = await convex.action(api.chat.sendMessage, {
        threadId: threadRef.current,
        sessionId,
        text: q,
        turnstileToken: turnstileToken || "dev",
      });
      setMsgs([
        ...next,
        { role: "bot", text: reply.text, contact: reply.contact },
      ]);
    } catch (err) {
      let text = FALLBACK_TEXT;
      if (err instanceof ConvexError && typeof err.data === "string") {
        text = err.data;
        if (text.startsWith("Chat session expired")) threadRef.current = null;
        if (text.startsWith("Verification failed")) {
          tokenRef.current = "";
          executedRef.current = false;
          turnstileRef.current?.reset();
        }
      }
      setMsgs([...next, { role: "bot", text, contact: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  /** Close the panel and hand focus back to the launcher pill (2.4.3). */
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => pillRef.current?.focus());
  };

  return (
    <div onKeyDown={(e) => e.key === "Escape" && open && close()}>
      <style>{FAQBOT_CSS}</style>
      {!open && (
        <button
          ref={pillRef}
          type="button"
          className="faqbot-pill"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="message-square" size={16} />
          Ask the shop
        </button>
      )}
      {open && (
        <div
          className="faqbot-panel"
          role="dialog"
          aria-label="Ask the shop"
        >
          <HazardBar variant="red" height="6px" />
          <div className="faqbot-head">
            <div>
              <div className="faqbot-title">Ask the shop</div>
              <div className="faqbot-sub">
                Answers from Eric&apos;s FAQ — not a person
              </div>
            </div>
            <button
              type="button"
              className="faqbot-close"
              onClick={close}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div
            className="faqbot-list"
            ref={listRef}
            role="log"
            aria-live="polite"
            tabIndex={0}
          >
            {msgs.map((m, i) => (
              <div
                key={i}
                className="faqbot-msg"
                style={{
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  className={
                    m.role === "user"
                      ? "faqbot-bubble faqbot-bubble--user"
                      : "faqbot-bubble faqbot-bubble--bot"
                  }
                >
                  {m.text}
                </div>
                {m.contact && (
                  <div className="faqbot-cta-row">
                    <a href="tel:8178946357" className="faqbot-cta-call">
                      Call Eric
                    </a>
                    <a
                      href="mailto:eric@tidwellwelding.com"
                      className="faqbot-cta-mail"
                    >
                      Email Eric
                    </a>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="faqbot-busy">Checking the FAQ…</div>}
          </div>
          {TURNSTILE_SITE_KEY ? (
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              options={{
                execution: "execute",
                appearance: "interaction-only",
                theme: "dark",
              }}
              onSuccess={resolveToken}
              onExpire={() => {
                tokenRef.current = "";
                executedRef.current = false;
              }}
              onError={() => resolveToken("")}
            />
          ) : null}
          <div className="faqbot-inputrow">
            <input
              ref={inputRef}
              className="faqbot-input"
              value={input}
              maxLength={MAX_INPUT_CHARS}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Service area, pricing, materials…"
              aria-label="Ask a question"
            />
            <button
              type="button"
              className="faqbot-send"
              onClick={() => void send()}
              disabled={busy}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FAQBOT_CSS = `
.faqbot-pill{position:fixed;right:24px;bottom:24px;z-index:90;display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#23262a 0%,#16181b 100%);border:1px solid rgba(255,255,255,.14);color:#ffffff;padding:12px 18px;cursor:pointer;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);font-family:var(--font-mono,"IBM Plex Mono",monospace);font-size:12px;letter-spacing:0.16em;text-transform:uppercase;box-shadow:0 2px 0 #000}
.faqbot-pill:hover{background:linear-gradient(180deg,#2b2f34 0%,#1b1e21 100%);border-color:rgba(201,3,20,.7)}
.faqbot-pill:active{transform:translateY(1px)}
.faqbot-panel{position:fixed;right:24px;bottom:24px;z-index:90;width:372px;max-width:calc(100vw - 32px);background:#0d0e0f;border:1px solid rgba(255,255,255,.14);clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px);box-shadow:0 2px 0 #000,0 24px 48px rgba(0,0,0,.5);display:flex;flex-direction:column}
.faqbot-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
.faqbot-title{font-family:var(--font-display,"Saira Condensed",sans-serif);font-weight:900;font-style:oblique 10deg;font-size:20px;text-transform:uppercase;color:#ffffff;line-height:0.95}
.faqbot-sub{font-family:var(--font-mono,"IBM Plex Mono",monospace);font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-top:3px}
.faqbot-close{background:none;border:1px solid rgba(255,255,255,.14);color:#ffffff;width:28px;height:28px;cursor:pointer;font-family:var(--font-body,Archivo,sans-serif);font-size:13px;line-height:1;flex:none}
.faqbot-close:hover{border-color:rgba(201,3,20,.7)}
.faqbot-list{height:320px;max-height:calc(100dvh - 200px);overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#080808}
.faqbot-msg{display:flex;flex-direction:column;gap:8px}
.faqbot-bubble{max-width:85%;padding:10px 12px;font-family:var(--font-body,Archivo,sans-serif);font-size:14px;line-height:1.5;color:#eef0f1;border:1px solid rgba(255,255,255,.1);clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);white-space:pre-wrap;overflow-wrap:anywhere}
.faqbot-bubble--user{background:linear-gradient(180deg,#23262a 0%,#16181b 100%)}
.faqbot-bubble--bot{background:#0d0e0f}
.faqbot-cta-row{display:flex;gap:8px}
.faqbot-cta-call,.faqbot-cta-mail{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono,"IBM Plex Mono",monospace);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#ffffff;padding:8px 12px;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.faqbot-cta-call{background:linear-gradient(180deg,#e2101f 0%,#a00210 100%)}
.faqbot-cta-mail{border:1px solid rgba(255,255,255,.2)}
.faqbot-cta-mail:hover{border-color:rgba(201,3,20,.7)}
.faqbot-busy{font-family:var(--font-mono,"IBM Plex Mono",monospace);font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.faqbot-inputrow{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.1)}
.faqbot-input{flex:1;min-width:0;background:#131518;border:1px solid rgba(255,255,255,.40);border-bottom:2px solid rgba(255,255,255,.40);border-radius:0;color:#eef0f1;font-family:var(--font-body,Archivo,sans-serif);font-size:14px;padding:10px 12px;outline:none}
.faqbot-input:focus{border-bottom-color:#c90314}
.faqbot-input::placeholder{color:rgba(238,240,241,.6)}
.faqbot-send{background:linear-gradient(180deg,#e2101f 0%,#a00210 100%);border:none;color:#ffffff;padding:0 16px;cursor:pointer;font-family:var(--font-mono,"IBM Plex Mono",monospace);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.faqbot-send:active{transform:translateY(1px)}
.faqbot-send:disabled{opacity:.6;cursor:default}
/* Clip-path chamfers swallow the global outset focus ring; draw it inset (2.4.7). */
.faqbot-pill:focus-visible,.faqbot-send:focus-visible,.faqbot-cta-call:focus-visible,.faqbot-cta-mail:focus-visible{box-shadow:inset 0 0 0 2px var(--black-900),inset 0 0 0 4px var(--arc-blue)}
@media (max-width: 480px){
  .faqbot-pill{right:16px;bottom:16px}
  .faqbot-panel{right:16px;bottom:16px}
}
`;

export { FaqBot };
