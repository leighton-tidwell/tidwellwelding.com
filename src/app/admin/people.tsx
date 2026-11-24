"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Badge, Button, Icon, Input, Select } from "@/components/ds";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  assignableRoles,
  NEVER_GRANTABLE,
  outranks,
  type Permission,
  ROLE_LABELS,
  type Role,
} from "../../../convex/lib/permissions";

/**
 * People: invite, re-send, deactivate, role, supervisor and overrides. The
 * controls shown follow the viewer's permissions, but every call is checked
 * again on the server (convex/people.ts).
 */

export type Me = NonNullable<FunctionReturnType<typeof api.people.me>>;
type Person = FunctionReturnType<typeof api.people.list>[number];

function message(err: unknown): string {
  return err instanceof ConvexError
    ? String(err.data)
    : "Something went wrong. Try again.";
}

/** Runs an async call, keeping its error for display. */
function useRun() {
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = async <T,>(
    fn: () => Promise<T>,
    done?: string | ((result: T) => string),
  ) => {
    setError("");
    setNote("");
    try {
      const result = await fn();
      if (done) setNote(typeof done === "string" ? done : done(result));
    } catch (err) {
      setError(message(err));
    }
  };
  const feedback = (
    <>
      {error ? (
        <p className="admin-gate__error" role="alert">
          {error}
        </p>
      ) : null}
      {note ? <p className="admin-note">{note}</p> : null}
    </>
  );
  return { run, feedback };
}

const emailed = (r: { emailed: boolean }, what: string) =>
  r.emailed ? `${what} emailed.` : `${what} created, but email is not set up.`;

export default function People({ token, me }: { token: string; me: Me }) {
  const people = useQuery(api.people.list, { token });
  const [openId, setOpenId] = useState<Id<"adminUsers"> | null>(null);
  const actor = { role: me.role, permissions: new Set(me.permissions) };
  const open = people?.find((p) => p.id === openId);

  return (
    <>
      <div className="admin-head">
        <div>
          <p className="admin-eyebrow">Accounts</p>
          <h1 className="admin-title">People</h1>
        </div>
      </div>

      {actor.permissions.has("users.invite") ? (
        <InviteCard token={token} actor={actor} people={people ?? []} />
      ) : null}

      {people === undefined ? (
        <p className="admin-note">Loading…</p>
      ) : (
        <div className="admin-list">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className="admin-row"
              aria-expanded={person.id === openId}
              onClick={() => setOpenId(person.id === openId ? null : person.id)}
            >
              <span className="admin-row__main">
                <span className="admin-row__title">
                  {person.name ?? person.email}{" "}
                  <Badge variant={person.role === "owner" ? "accent" : "idle"}>
                    {ROLE_LABELS[person.role]}
                  </Badge>{" "}
                  {person.status !== "active" ? (
                    <Badge
                      variant={
                        person.status === "deactivated" ? "danger" : "warn"
                      }
                    >
                      {person.status}
                    </Badge>
                  ) : null}
                </span>
                <span className="admin-row__meta">
                  {[person.title, person.email].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Icon name="chevron-right" />
            </button>
          ))}
        </div>
      )}

      {open && people ? (
        <PersonPanel
          key={open.id}
          token={token}
          me={me}
          actor={actor}
          person={open}
          people={people}
        />
      ) : null}
    </>
  );
}

type Actor = { role: Role; permissions: Set<Permission> };

function supervisorOptions(people: Person[], except?: Id<"adminUsers">) {
  return [
    { value: "", label: "No supervisor" },
    ...people
      .filter((p) => p.status !== "deactivated" && p.id !== except)
      .map((p) => ({ value: p.id, label: p.name ?? p.email })),
  ];
}

function InviteCard({
  token,
  actor,
  people,
}: {
  token: string;
  actor: Actor;
  people: Person[];
}) {
  const invite = useAction(api.people.invite);
  const { run, feedback } = useRun();
  const blank = { name: "", email: "", title: "", role: "employee" };
  const [form, setForm] = useState(blank);
  const [supervisorId, setSupervisorId] = useState("");
  const roles = actor.permissions.has("roles.assign")
    ? assignableRoles(actor)
    : (["employee"] as Role[]);
  const set = (key: keyof typeof blank) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="admin-card">
      <h2 className="admin-card__title">Invite someone</h2>
      <div className="admin-grid-2">
        <Input label="Name" value={form.name} onChange={set("name")} />
        <Input
          label="Email"
          value={form.email}
          onChange={set("email")}
          inputMode="email"
        />
        <Input label="Title" value={form.title} onChange={set("title")} />
        <Select
          label="Role"
          options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          value={form.role}
          onChange={set("role")}
        />
        <Select
          label="Supervisor"
          options={supervisorOptions(people)}
          value={supervisorId}
          onChange={setSupervisorId}
        />
      </div>
      <div className="admin-actions">
        <Button
          onClick={() =>
            run(
              async () => {
                const r = await invite({
                  token,
                  name: form.name,
                  email: form.email,
                  title: form.title || undefined,
                  role: form.role as Role,
                  supervisorId: (supervisorId || undefined) as
                    | Id<"adminUsers">
                    | undefined,
                });
                setForm(blank);
                setSupervisorId("");
                return r;
              },
              (r) => emailed(r, "Invite"),
            )
          }
        >
          <Icon name="plus" /> Send invite
        </Button>
      </div>
      {feedback}
    </div>
  );
}

function PersonPanel({
  token,
  me,
  actor,
  person,
  people,
}: {
  token: string;
  me: Me;
  actor: Actor;
  person: Person;
  people: Person[];
}) {
  const sendLink = useAction(api.people.sendLink);
  const setActive = useMutation(api.people.setActive);
  const setRole = useMutation(api.people.setRole);
  const setSupervisor = useMutation(api.people.setSupervisor);
  const setOverride = useMutation(api.people.setOverride);
  const removeOverride = useMutation(api.people.removeOverride);
  const { run, feedback } = useRun();
  const [rule, setRule] = useState({
    permission: "",
    effect: "grant",
    reason: "",
    expires: "",
  });

  const can = (p: Permission) => actor.permissions.has(p);
  const below = person.id !== me.id && outranks(actor.role, person.role);
  const roles = assignableRoles(actor);
  const grantable = me.permissions.filter(
    (p) => !NEVER_GRANTABLE.includes(p as Permission),
  );

  return (
    <section
      className="admin-card"
      aria-label={`Manage ${person.name ?? person.email}`}
    >
      <h2 className="admin-card__title">{person.name ?? person.email}</h2>
      <p className="admin-note">
        {person.status === "invited"
          ? person.linkExpiresAt
            ? `Invite link live until ${new Date(person.linkExpiresAt).toLocaleString()}.`
            : "Invite link expired or used. Send a new one."
          : `Account ${person.status}.`}
      </p>

      <div className="admin-grid-2">
        {can("roles.assign") && below ? (
          <Select
            label="Role"
            options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={person.role}
            onChange={(role) =>
              run(
                () => setRole({ token, userId: person.id, role: role as Role }),
                "Role changed. They have been signed out.",
              )
            }
          />
        ) : null}
        {can("supervision.manage") ? (
          <Select
            label="Supervisor"
            options={supervisorOptions(people, person.id)}
            value={person.supervisorId ?? ""}
            onChange={(id) =>
              run(
                () =>
                  setSupervisor({
                    token,
                    userId: person.id,
                    supervisorId: (id || null) as Id<"adminUsers"> | null,
                  }),
                "Supervisor saved.",
              )
            }
          />
        ) : null}
      </div>

      {below ? (
        <div className="admin-actions">
          {person.status !== "deactivated" &&
          can(person.status === "invited" ? "users.invite" : "users.manage") ? (
            <Button
              variant="secondary"
              onClick={() =>
                run(
                  () => sendLink({ token, userId: person.id }),
                  (r) =>
                    emailed(
                      r,
                      person.status === "invited" ? "New invite" : "Reset link",
                    ),
                )
              }
            >
              {person.status === "invited" ? "Re-send invite" : "Send reset"}
            </Button>
          ) : null}
          {can("users.manage") ? (
            <Button
              variant="secondary"
              onClick={() =>
                run(() =>
                  setActive({
                    token,
                    userId: person.id,
                    active: person.status === "deactivated",
                  }),
                )
              }
            >
              {person.status === "deactivated" ? "Reactivate" : "Deactivate"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <h3 className="admin-card__title">Overrides</h3>
      {person.overrides.length === 0 ? (
        <p className="admin-note">None. They have exactly their role.</p>
      ) : (
        <div className="admin-list">
          {person.overrides.map((o) => (
            <div key={o.id} className="admin-row">
              <span className="admin-row__main">
                <span className="admin-row__title">
                  <Badge variant={o.effect === "grant" ? "ok" : "danger"}>
                    {o.effect}
                  </Badge>{" "}
                  {o.permission}
                </span>
                <span className="admin-row__meta">
                  {o.reason}
                  {o.expiresAt
                    ? ` · until ${new Date(o.expiresAt).toLocaleDateString()}`
                    : ""}
                </span>
              </span>
              {can("overrides.manage") && below ? (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() =>
                    run(() => removeOverride({ token, overrideId: o.id }))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {can("overrides.manage") && below ? (
        <>
          <div className="admin-grid-2">
            <Select
              label="Permission"
              placeholder="Pick a permission"
              options={grantable}
              value={rule.permission}
              onChange={(permission) => setRule((r) => ({ ...r, permission }))}
            />
            <Select
              label="Effect"
              options={[
                { value: "grant", label: "Grant" },
                { value: "deny", label: "Deny" },
              ]}
              value={rule.effect}
              onChange={(effect) => setRule((r) => ({ ...r, effect }))}
            />
            <Input
              label="Reason"
              value={rule.reason}
              onChange={(reason) => setRule((r) => ({ ...r, reason }))}
            />
            <Input
              label="Expires (optional)"
              type="date"
              value={rule.expires}
              onChange={(expires) => setRule((r) => ({ ...r, expires }))}
            />
          </div>
          <div className="admin-actions">
            <Button
              disabled={!rule.permission}
              onClick={() =>
                run(async () => {
                  await setOverride({
                    token,
                    userId: person.id,
                    permission: rule.permission as Permission,
                    effect: rule.effect as "grant" | "deny",
                    reason: rule.reason,
                    expiresAt: rule.expires
                      ? new Date(`${rule.expires}T23:59:59`).getTime()
                      : undefined,
                  });
                  setRule({
                    permission: "",
                    effect: "grant",
                    reason: "",
                    expires: "",
                  });
                }, "Override saved.")
              }
            >
              Save override
            </Button>
          </div>
        </>
      ) : null}
      {feedback}
    </section>
  );
}
