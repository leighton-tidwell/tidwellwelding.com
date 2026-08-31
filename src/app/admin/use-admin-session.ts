"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tsws_admin_session";

/**
 * The session token lives in sessionStorage: it dies with the tab, and the real
 * security boundary is requireAdmin() on every Convex function, not this value.
 * Nothing here is trusted by the server.
 */
export function useAdminSession() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount so the server and first client render agree (no hydration
  // mismatch from touching sessionStorage during render).
  useEffect(() => {
    try {
      setToken(window.sessionStorage.getItem(STORAGE_KEY));
    } catch {
      setToken(null);
    }
    setReady(true);
  }, []);

  const signIn = useCallback((next: string) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can refuse writes; the in-memory token still works.
    }
    setToken(next);
  }, []);

  const signOut = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do — clearing state below is what matters.
    }
    setToken(null);
  }, []);

  return { token, ready, signIn, signOut };
}
