# Project detail display simplification — 2026-10-19

User reported excessive information on project #12. This slice changes only
presentation in the project detail page, using the existing DTOs and calculations.

- Keep deadline, owner, completion count and nonzero overdue count visible.
- Keep the shared status badge; move phase dates, progress, description and gate
  explanations into a keyboard-accessible native details disclosure.
- Remove duplicate rollout banners and internal transaction explanations.
  Existing disabled actions, server capability checks and locked status remain.
- Render the task table only when tasks exist. A short empty message replaces
  the wide empty table. Primary task columns remain visible; priority, dependency,
  update time, progress and comments remain available in each row's disclosure.
  Mobile cards use the same progressive disclosure.
- Collapse supporting project metadata/Drive and member workload panels.
  Forms and their permission gates remain intact when expanded.

No API, DB, business status, permission, feature flag, dependency or data changes.
Revert this page/test diff to restore the former layout; no data rollback needed.

Validation: full existing test suite, lint, production build, TypeScript and diff
checks. Browser verification is recorded with the delivery in the shared roadmap.
Native disclosures have visible keyboard focus and task-specific accessible names.
