# ERP UI/UX Polish Handoff

## Purpose and boundary

This handoff records the visual and interaction consistency work intentionally deferred until the functional roadmap and production capability rollouts are complete. It is not authority to redesign business workflows, reopen completed foundations, or replace server-derived authorization with client behavior.

Before starting polish, verify that the Phase Workflow, normalized task, Attendance recovery, finance, and payroll capabilities used by the target screen are live. Preserve Vietnamese interface language, stable identifiers, server boundaries, and existing regression coverage.

## Review queue

| Area | Review target | Completion evidence |
| --- | --- | --- |
| Layout consistency | Align page headers, breadcrumbs, content widths, section rhythm, and dense operational cards across admin list/detail pages. | Side-by-side desktop captures use the same page grid and header hierarchy. |
| Spacing and typography | Consolidate repeated spacing, heading, metadata, table-density, and helper-text patterns without changing information priority. | Token/pattern inventory and before/after captures at representative widths. |
| Modal sizing | Check employee, project, task, attendance, account, and finance dialogs for viewport fit, scroll ownership, sticky actions, and long Vietnamese copy. | Keyboard-only walkthrough at desktop and mobile widths. |
| Project Detail | Review phase stepper density, locked/completed/current state contrast, task grouping, members, activity, comments, and capability-disabled actions after live workflow verification. | Captures for active, locked, completed, cancelled, compatibility, empty, and section-error states. |
| Employee Detail | Review tab hierarchy, account/permission density, facility labels, destructive-action separation, loading, empty, and error states. | Captures for connected, unconnected, inactive, and permission-limited accounts. |
| Mobile Attendance | Prioritize thumb reach, check-in/check-out state clarity, open-shift prominence, facility context, location errors, retry, and history scanning. | Device-width captures plus a complete check-in/check-out interaction recording against a safe test environment. |
| Responsive admin pages | Check tables, filters, cards, charts, dialogs, and sticky actions at narrow, tablet, laptop, and wide widths. | No horizontal page overflow; data tables have an intentional compact/card/scroll behavior. |
| Loading and skeletons | Normalize route skeletons, inline refresh indicators, action overlays, and retry states; avoid replacing known content during targeted refresh. | Slow-network capture for every primary module. |
| Dark mode contrast | Validate text, muted metadata, borders, charts, status badges, disabled controls, focus rings, overlays, and destructive actions. | Automated contrast results plus manual captures for both themes. |
| Toast consistency | Standardize placement, duration, tone, duplicate suppression, actionable errors, and success wording. | One toast matrix covering success, validation, authorization, conflict, and retryable failure. |
| Button hierarchy | Normalize primary, secondary, quiet, destructive, icon-only, loading, and disabled states. Keep dangerous actions visually separated. | Each detail page has one unambiguous primary action per context. |
| Navigation cleanup | Validate permission-aware visibility, active states, breadcrumbs, mobile navigation, compatibility redirects, and canonical project routing. | Route matrix by workspace and permission profile. |

## Screenshot set required for review

Screenshots remain required before approving any perceptible UI change. Capture real application states without production mutation or exposed personal/financial data:

1. Admin Dashboard at desktop and mobile widths.
2. Project list and canonical Project Detail for active, cancelled, locked-phase, and compatibility states.
3. Employee list/detail, including **Tài khoản & phân quyền** and facility history.
4. Staff Attendance idle, open-shift, retry/error, and history states.
5. Admin Attendance and manual recovery dialogs using safe fixtures.
6. Ledger create/edit/list and reimbursement status states with redacted attachment examples.
7. Payroll monthly summary, unsettled, settled, and revision states.
8. Light and dark themes for every representative screen.

Record viewport size, theme, account/workspace role, capability state, and fixture state with each capture. Do not use production mutation merely to manufacture a screenshot state.

## Recommended execution order

1. Confirm live capability and functional stabilization gates.
2. Establish shared page, form, dialog, status, loading, and toast patterns.
3. Polish mobile Attendance and high-frequency admin workflows.
4. Polish Project Detail and Employee Detail state density.
5. Normalize remaining responsive admin pages and navigation.
6. Run accessibility, responsive, and theme validation.
7. Attach the required screenshots and interaction notes to the polish pull request.

## Exit criteria

- Functional behavior, business rules, authorization, and persistence contracts are unchanged unless a separately approved defect is proven.
- Vietnamese labels remain consistent and no technical rollout terminology appears in product copy.
- Loading, empty, error, retry, disabled, and cancelled/read-only states are visually distinct.
- Keyboard focus, touch targets, contrast, viewport fit, and responsive behavior pass review.
- Required screenshots are attached and contain no secrets or sensitive production data.

## SaaS UI foundation — 2026-07-28

### Completed safe scope

The admin shell now owns the responsive desktop/mobile navigation frame, sticky context header, consistent content offset, active-route treatment, focus visibility, and restrained SaaS visual tokens. Shared, domain-neutral patterns now cover page width and rhythm, page headings, cards, table shells, buttons, badges, labelled fields, disabled controls, dialogs, skeletons, operational states, and top-right global toast placement below the sticky header.

The foundation is applied to the authentication screens, Dashboard, employee list and detail, project list, the existing read-only presentation within Project Detail, and the account list/read-only presentation. All existing fetches, server authorization, capability checks, payload shapes, route transitions, controlled errors, and mutation handlers remain unchanged. No runtime flag, database contract, API contract, SQL, or production data was changed.

### Intentionally deferred

Facility screens and all Phase, Task, Attendance recovery, Ledger, and Payroll mutation experiences remain outside this slice. They may inherit low-level focus, disabled, typography, and color tokens, but their workflow composition, controls, visibility, dialogs, and business behavior were not redesigned. Project Detail mutation areas and account permission mutation workflows were likewise not restructured; only their safe shared container treatment is in scope.

Staff Portal behavior and layout remain mobile-first and were not changed. Broader animation, light-theme introduction, new command/search behavior, and capability activation remain deferred.

### Validation and review evidence

Required automated gates for this slice are `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Perceptible UI review should use local authenticated fixtures only; do not mutate production or expose employee, account, project, or financial data in captures.

### Rollback

Revert the two SaaS UI foundation commits to restore the previous shell and surface classes. There is no database, API, permission, feature-flag, migration, or data rollback. After rollback, verify admin navigation on desktop/mobile, authentication submission, controlled retry states, and capability-hidden actions.
