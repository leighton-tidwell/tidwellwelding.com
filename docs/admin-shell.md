# Admin shell

How the `/admin` console is put together, and how to add a screen to it.

The design follows the taste skill (github.com/Leonxlnx/taste-skill,
`references/system.md`, `layout-v4.md`, `motion.md` and `library/type.json`),
used as guidance only:

- The interface is neutral with one accent. For now that accent is the
  business's brand red, held in `--adm-accent` so it can become a
  per-workspace setting.
- Type is Geist, with Geist Mono for IDs and money in tables. Weights are 400
  and 500. Body text is 16px and nothing is under 13px.
- Buttons are 44px tall and fields are 48px.
- Motion runs 150/120/90ms with no bounce, and hover effects apply only to
  fine pointers.

The structure:

- **Sidebar:** a workspace badge on top, then sections under headings (Work,
  Billing, Contacts, Team, Admin).
- **List screens:** each opens with a strip of figures (what is outstanding,
  what is new), then a ledger whose columns line up under a header.
- **Editors:** the form on the left, and a sticky summary panel on the right
  with status, totals and the document's actions.

## Pieces

| File                       | What                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/tokens.css` | Design tokens: type scale, 4px spacing, radii, motion, and light and dark colors. Every token is `--adm-*`.      |
| `src/app/admin/admin.css`  | Every console style, built only on those tokens. It re-skins the shared `ds` components inside the console only. |
| `src/app/admin/layout.tsx` | Loads the console's faces, Geist and Geist Mono.                                                                 |
| `src/app/admin/nav.ts`     | The one list of sections. The sidebar and the phone tab bar both render from it.                                 |
| `src/app/admin/shell.tsx`  | `AdminShell`, `PageHeader`, `StatStrip`, `LoadingState`, `EmptyState`, `ErrorState`, `StatusMark`.               |

Everything is scoped under the `.adm` class. The public site's tokens and
components in `globals.css` are not touched, so a console change cannot leak
onto the marketing pages.

## Layout

- **Phone (under 900px):** a top bar with the business name and Sign out, and
  the sections in a tab bar at the bottom of the screen. The page scrolls
  between them.
- **Desktop:** the same element becomes a full-height sidebar.

There is one nav element, not two, so each section is a single button for
screen readers and for the e2e suite. The current section has
`aria-current="page"` and is raised out of the rail (on a phone, its icon sits in an accent-tinted pill).

## Adding a section

1. In `nav.ts`, set the section's `ready: true`. When roles land, give it a
   `permission` and pass a `can` function to `visibleSections`.
2. In `admin-console.tsx`, add the screen's views to `View`, map them in
   `SECTION_OF`, and give the section its landing view in `HOME_OF`.
3. Build the screen from `PageHeader` (title, a meta line, optional back link
   and aside), `admin-card` sections, `admin-list` / `admin-row` ledgers, and
   `LoadingState` / `EmptyState` for the in-between states. A screen that
   throws is caught by the shell and shows `ErrorState` with a retry.

The tab bar fits five sections on a phone. A sixth needs a "More" item; that
is still to be built, along with the sections that need it.

## Rules the styles keep

- The accent (`--adm-accent`) is only for the primary action, the current
  section, links and focus. It is never decoration.
- There are no labels stacked above headings. Context goes in the meta line
  under the title.
- Statuses are pills with a dot, tinted only where the status means something.
  Void records stay in their lists, struck through.
- Touch targets are at least 44px on phones. Text contrast is at least 4.5:1
  in both modes; axe checks it in `tests/e2e/admin.spec.ts`.

## Screenshots

`make screenshot` takes `SCHEME=dark` and `CLICK="Quotes,/Jesse Ward/"`
(buttons to press, in order, by accessible name; `/.../` is a regex) to reach
a console view that has no URL of its own. It reuses one signed-in session, so
a batch of shots does not trip the login rate limit.
