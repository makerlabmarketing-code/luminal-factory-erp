# Responsive navigation remediation — 08/10/2026

Scope: fixes R01–R05 from the 07/10 repository audit. Loading animation selection remains paused; the droplet preview has not been integrated.

ERP: facility table has a named, keyboard-focusable horizontal scroll region and 800px minimum table width. Mobile navigation becomes inert when closed; when open it isolates content, locks background scrolling, contains Tab/Shift+Tab, supports Escape and restores focus. Desktop navigation stays available at 1024px; crossing the breakpoint closes the mobile state. Search has a persistent accessible name. Shared table/header actions have 44px minimum touch targets under any-pointer:coarse, including tablet landscape.

Commerce: the existing mobile menu keeps its visual design, contains keyboard focus including its close trigger, focuses a navigation link on open, isolates background branches, locks scroll and restores previous inert/scroll states on close/unmount. Crossing 900px closes the menu.

Validation: ERP lint, TypeScript, 922 tests and production build passed (build-only placeholder public Supabase variables). Commerce lint (two pre-existing warnings), typecheck, 376 tests, static security and production build passed. No dependency, database, API, runtime flag, product content or loading behavior changes.

Limit: the current browser does not expose mobile viewport emulation. Safari iOS/iPadOS, touch, rotation and external-keyboard verification are still required; automated/source checks are not device acceptance.

Rollback: revert this application commit in each repository; no database rollback required. E-009 SQL remains unapproved and inactive. C-040/C-041/C-042/C-043 still depend on approved references or factual content.
