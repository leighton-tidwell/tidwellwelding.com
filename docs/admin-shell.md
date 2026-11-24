# Admin shell

How the `/admin` console is put together, and how to add a screen to it.

The design follows the taste skill (github.com/Leonxlnx/taste-skill,
`references/system.md` and `motion.md`), used as guidance only:

- Body text is 16px and nothing is under 13px. Field labels are 14px in
  sentence case.
- Buttons are 44px tall with a 16px label and 24px of side padding. Fields are
  48px.
- Radii are the skill's sharp 4/6/8.
- Surfaces are flat, with hairline rules.
- There is one accent.
- Motion runs 150/120/90ms with no bounce, and hover effects apply only to fine
  pointers.

The look is a dark steel rail beside a chalk-light workspace, with paint-marker
yellow as the one accent. Dark mode keeps the rail and darkens the workspace.

## Pieces

| File                       | What                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/tokens.css` | Design tokens: type scale, 4px spacing, radii, motion, and light and dark colors. Every token is `--adm-*`.      |
| `src/app/admin/admin.css`  | Every console style, built only on those tokens. It re-skins the shared `ds` components inside the console only. |
| `src/app/admin/layout.tsx` | Loads the console's face, Public Sans.                                                                           |
| `src/app/admin/nav.ts`     | The one list of sections. The sidebar and the phone tab bar both render from it.                                 |
| `src/app/admin/shell.tsx`  | `AdminShell`, `PageHeader`, `LoadingState`, `EmptyState`, `ErrorState`, `StatusMark`.                            |

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
`aria-current="page"` and the yellow marker stroke.

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

- Paint-marker yellow (`--adm-marker`) is only for primary actions and "you
  are here". It is never decoration.
- There are no labels stacked above headings. Context goes in the meta line
  under the title.
- Statuses are marks (dot, ring, dash), not filled boxes. Void records stay in
  their lists, struck through.
- Touch targets are at least 44px on phones. Text contrast is at least 4.5:1
  in both modes; axe checks it in `tests/e2e/admin.spec.ts`.

## Screenshots

`make screenshot` takes `SCHEME=dark` and `CLICK="Quotes,/Jesse Ward/"`
(buttons to press, in order, by accessible name; `/.../` is a regex) to reach
a console view that has no URL of its own. It reuses one signed-in session, so
a batch of shots does not trip the login rate limit.
