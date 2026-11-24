# Admin: roles, jobs, businesses and the time clock

Status: spec, agreed 2026-11-24. Built in the PRs listed at the end. Anything marked **(assumed)** was a default picked without an explicit answer; change it here before the PR that builds it.

## Goals

- People get accounts the way an HR team would issue them: created by someone with the right role, set up through an emailed link, re-sendable on demand.
- Everyone sees only what their role and assignments allow, and the server enforces it. The UI hides what you can't use, but hiding is never the control.
- A **job** is the unit of work. Quotes, invoices, packing slips, assignments and hours all hang off a job, and every job belongs to a **business**.
- Employees clock in and out from a phone. HR and the owner can correct time, with every correction audited.

## Roles

Fixed roles, defined in code (`convex/lib/permissions.ts`). A role is a named set of permissions; the set lives in code so it is reviewed and tested like any other logic.

| Role      | Who                      | Sees and does                                                                                                                   |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Developer | Leighton                 | Everything, plus system tools. Super admin. Only a developer can grant this role.                                               |
| Owner     | Eric                     | Everything in the business, including all money: quote pricing, invoices, payments, wages.                                      |
| HR        | Office / people admin    | People: create, invite, deactivate, set role (up to HR), set supervisors, wages, every timesheet and its edits. No job dollars. |
| Manager   | Crew lead                | Jobs they manage or that their reports are on; assign their reports; see and approve their reports' time. No dollars or wages.  |
| Employee  | Welder, fabricator, etc. | Jobs assigned to them (scope, drawings, files, site contact, notes); their own clock and timesheet. No dollars.                 |

Money is its own permission (`financials.read` / `financials.write`). Only Owner and Developer hold it by default, so it can later be granted to one trusted manager through an override without inventing a role.

### Permissions

`users.read`, `users.invite`, `users.manage`, `roles.assign`, `overrides.manage`, `supervision.manage`, `wages.read`, `wages.write`, `time.own`, `time.read.team`, `time.read.all`, `time.approve.team`, `time.edit.all`, `jobs.read.assigned`, `jobs.read.team`, `jobs.read.all`, `jobs.write`, `jobs.assign`, `businesses.read`, `businesses.write`, `quotes.inbox`, `financials.read`, `financials.write`, `settings.shop`, `system.developer`.

### Per-user overrides

Yes, this is still proper RBAC: roles carry the defaults and a small, audited set of exceptions sits on top. It is the same model GitHub and most cloud consoles use. The rules that keep it from turning into per-person permission soup:

- An override is a **grant** or a **deny** of one permission for one user, with a required reason, who set it, and an optional expiry.
- Deny beats grant; the effective set is `role ∪ grants − denies`.
- You can only grant a permission you hold yourself, and only to someone below you.
- `system.developer` and `roles.assign` above HR are never grantable by override.
- Overrides show on the person's profile, so nobody has hidden powers.

### Scope

A permission says _what kind_ of thing you can touch; scope says _which rows_. Every Convex query and mutation goes through one helper, `requireAccess(ctx, permission, resource?)`, which resolves the session, the effective permissions, and the row scope (own, team, all). No handler reads `ctx.db` for admin data without it. "Team" means the manager's direct and indirect reports in the supervision tree that HR maintains.

## Accounts

- `adminUsers` grows into the user table: `name`, `role`, `status` (`invited`, `active`, `deactivated`), `supervisorId`, `phone`, `title`, `hiredAt`.
- Creating a user sends a **set-password link** by email (Resend, already wired). The link lasts 72 hours and is single-use; the existing `setupTokens` table gains a `purpose` (`invite`, `reset`). No emailed temporary passwords: a link is safer and does the same job.
- HR or the owner can re-send the invite or send a reset at any time. Re-sending burns the older link.
- Deactivating someone, or changing their role, revokes their sessions immediately.
- Every change to a person, role, override, supervisor or wage goes to `auditLog` (actor, action, target, before, after, at).
- The existing operator account becomes **Owner** in a migration. Developer is seeded locally and created in prod by hand through the internal mutation.

## Businesses and contacts

- `customers` becomes `businesses`: name, billing address, notes, status. Existing rows are backfilled; every reference keeps working through the migration.
- `contacts` are people at a business: name, title, email, phone, active. A business has many.
- Each business has a primary contact, and each job can pin its own. Changing either writes a row to `contactHistory` (subject, contact, from, to, changedBy), so you can see that the POC on an ongoing contract changed and when.
- The business page is Eric's customer view: its contacts, every job, and (with `financials.read`) every quote, invoice and balance.

## Jobs

- `jobs`: number (`J-0001`), business, title, status, manager, primary contact, site address, PO, dates.
- Status: `lead`, `quoted`, `won`, `in_progress`, `complete`, `invoiced`, `closed`, `lost`.
- `jobAssignments`: who is on the job, assigned by whom, from/to, so past crews stay visible.
- `quotes`, `invoices` and `packingSlips` gain an optional `jobId`. A quote request from the site creates a `lead` job when the owner saves it to a business. **(assumed)** Existing quotes/invoices/slips are backfilled into jobs: one job per quote→invoice→slip chain, orphans get a job each.
- The job page is the hub: scope and files, crew, hours by person, quote, invoices, packing slips, contact history. Money sections render only with `financials.read`.

## Time clock

- A **shift** is one clock-in to clock-out. Within it, **time entries** say what you worked on: a job you're assigned to, or shop time. Switching jobs closes one entry and opens the next.
- **(assumed)** Unpaid breaks are entries of kind `break`. No GPS capture for now.
- **(assumed)** A shift still open after 12 hours is flagged for the manager and HR instead of being closed silently.
- **(assumed)** Weekly timesheets: the manager approves their reports' week; HR can edit any entry. Every edit needs a reason and writes a `timeEdits` row with before and after. An approved week is locked unless HR reopens it.
- **(assumed)** HR keeps an hourly pay-rate history per person (`payRates`, effective-dated) and exports a weekly CSV with regular and overtime hours for payroll. Wages need `wages.read`.

## Admin console redesign

Runs alongside the backend work. A new shell for `/admin`: responsive navigation (sidebar on desktop, bottom bar on phones), a design-token layer in `src/app/admin/`, and the existing screens restyled on it. Direction: professional, quiet and distinctive, not a stock dashboard template, following the taste-skill guidance and the `impeccable` skill. The employee clock screen is designed phone-first.

## Environments

All of this is built and tried against the per-worktree local stack (`make dev`, `docs/local-stack.md`), which has its own self-hosted Convex and fake email. No work in these PRs points at the production Convex deployment, runs `convex deploy`, or touches `.env*` files. Production gets the schema and migrations only by merging to `main`.

## PRs

| #   | PR                      | Depends on | Contents                                                                                                          |
| --- | ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | RBAC core and accounts  | —          | Roles, permissions, overrides, `requireAccess`, user fields, invite/resend/reset email, audit log, People screen. |
| 2   | Businesses and contacts | —          | `businesses`, `contacts`, `contactHistory`, customer backfill, business page.                                     |
| 3   | Admin shell redesign    | —          | Design tokens, responsive nav, restyle of existing screens.                                                       |
| 4   | Jobs                    | 1, 2       | `jobs`, assignments, links from quotes/invoices/slips, backfill, scoped job queries, job hub.                     |
| 5   | Time clock              | 1, 4       | Shifts, entries, phone clock screen, edits, approvals, pay rates, CSV export.                                     |

1, 2 and 3 run in parallel; each touches `convex/schema.ts` in separate tables, so merges are additive. Splits are allowed to be refactored later.
