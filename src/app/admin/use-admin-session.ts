"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "tsws_admin_session";

/**
 * The session token lives in sessionStorage: it dies with the tab, and the real
 * security boundary is requireAdmin() on every Convex function, not this value.
 * Nothing here is trusted by the server.
 */

function read(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab signing out should not leave this one showing a live console.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

/**
 * True only after hydration. Both sides start from the server snapshot
 * (`false`), so the first client render matches the server's HTML; React then
 * re-reads and gets `true`. No setState, so no cascading-render lint either.
 */
const subscribeNoop = () => () => {};

export function useAdminSession() {
  // useSyncExternalStore reads sessionStorage without a setState-in-effect
  // cascade, and its server snapshot keeps hydration consistent.
  const token = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const signIn = useCallback((next: string) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse writes; nothing else to do.
    }
    emit();
  }, []);

  const signOut = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do — the emit below still re-reads and clears the UI.
    }
    emit();
  }, []);

  return { token, ready, signIn, signOut };
}
