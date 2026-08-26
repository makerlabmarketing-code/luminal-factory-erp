# SaaS UI Foundation Result

**Approved:** 2026-08-22  
**Status:** `APPLICATION_FOUNDATION_COMPLETE / BROAD_RESKIN_BLOCKED`

## Approved boundary

Item 18 Option A covers the shared Admin application shell only. It establishes
one reusable layout and permission-aware navigation without changing ERP page
workflows or visually redesigning unresolved operational journeys.

## Delivered foundation

- `lib/i18n/vi.ts` owns reusable Vietnamese shell, navigation, breadcrumb, and
  command-menu text.
- `lib/navigation/admin.ts` owns Admin navigation groups, routes, icon keys, and
  permission requirements.
- `services/server/auth.ts` resolves the requested navigation permissions in one
  read, preserves explicit `DENY` precedence, and fails closed on lookup error.
- `app/admin/layout.tsx` resolves navigation access on the server and passes only
  the effective permission-code list to the client shell.
- `component/app-shell/AdminAppShell.tsx` owns the sidebar, header, breadcrumb,
  main content, mobile drawer, workspace switch, and authorized `Ctrl/Command +
  K` navigation menu.
- `app/globals.css` owns semantic dark-shell tokens. `tailwind.config.ts` now
  scans the canonical `component/` directory.

The Dashboard link remains available to an authenticated Admin workspace as the
safe fallback. Every other displayed navigation link requires at least one of
the same permission codes used by its server-owned operational boundary. UI
visibility remains presentation only; APIs, services, and RLS continue to own
authorization.

## Compatibility decision

The repository already has shared Admin UI, operational-state, loading, toast,
and data-table primitives. Shadcn was inspected at the dependency boundary and
was not added: a second component system is unnecessary for this slice and would
increase bundle, styling, and migration risk. Efferd demo layout/data is not
introduced.

## Preserved boundaries

This slice changes no:

- page workflow or business calculation;
- API request/response contract;
- Supabase schema, RPC, RLS, grant, migration, or data;
- Vercel environment value or runtime flag;
- production fixture, template seed, or operator evidence classification.

Dark mode remains the current approved ERP presentation. Light-theme rollout,
page-by-page visual migration, Dashboard/Project redesign, and broad SaaS re-skin
remain outside Option A.

## Validation

- `npm test`: PASS, 99 test files / 760 tests.
- `npm run lint`: PASS with no ESLint errors or warnings.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS with build-only public placeholder values; 37 static
  pages generated and no production service contacted.
- `git diff --check`: PASS.

## Next gate

Stop after protected delivery of this foundation. Item 19 remains
`BLOCKED_BY_DEPENDENCY` until the business owner approves an explicit list of
affected journeys and every affected operator/runtime boundary has retained PASS
evidence.
