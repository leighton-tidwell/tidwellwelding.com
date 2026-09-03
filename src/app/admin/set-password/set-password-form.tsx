"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button, Input } from "@/components/ds";
import "../admin.css";

const MIN_LENGTH = 12;

export default function SetPasswordForm({ token }: { token: string }) {
  const setPassword = useMutation(api.auth.setPassword);
  const [password, setPassword_] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await setPassword({ token, password });
      setDone(true);
    } catch {
      // The server refuses a used, expired, or unknown token, and refuses any
      // account that already has a password. All of them land here.
      setError(
        "That link is no longer valid. It can only be used once — ask for a new one.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="admin-gate">
        <div className="admin-gate__plate">
          <h1 className="admin-gate__title">You are set</h1>
          <p className="admin-gate__sub">
            Your password is saved. This link will not work again.
          </p>
          <Button href="/admin" block>
            Go to the console
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-gate">
      <form
        className="admin-gate__plate"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="admin-gate__title">Pick a password</h1>
        <p className="admin-gate__sub">
          This link works once. After you save, it stops working for good.
        </p>

        <div className="admin-gate__fields">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={setPassword_}
            autoComplete="new-password"
            hint={`At least ${MIN_LENGTH} characters.`}
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <Button type="submit" block disabled={busy} ariaBusy={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </div>

        {error ? (
          <p className="admin-gate__error" role="alert">
            {error}{" "}
            <Link href="/admin" style={{ color: "inherit" }}>
              Back to sign in
            </Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}
