"use client";

const KEY = "tsws_session_id";

let memoryId: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  ).slice(0, 32);
}

/**
 * Random per-browser session id, persisted in localStorage. Used as the
 * rate-limit key for quote, estimate and chat calls. Falls back to an
 * in-memory id when storage is blocked (private mode).
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "server-render";
  if (memoryId) return memoryId;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = randomId();
      window.localStorage.setItem(KEY, id);
    }
    memoryId = id;
    return id;
  } catch {
    memoryId = randomId();
    return memoryId;
  }
}
