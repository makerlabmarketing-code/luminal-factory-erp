# ERP production status authority — 2026-08-09

This document is the current production reconciliation authority for roadmap items whose 2026-07-31 status in `docs/ERP_IMPLEMENTATION_ROADMAP.md` is now stale. It does not replace unresolved business-decision packages or their safety constraints.

Repository baseline for this reconciliation: `4cbf7341ede4354cf0787866c903006a275f794a`.
Production baseline observed before this document was created: `1fd25e0bfa6da508f26499575d5dba6286f80c52` via `/api/system/version`.

## Current reconciled status

| Area | Current status | Evidence / next gate |
|---|---|---|
| Finance linked-ledger atomic edit | `COMPLETE` for approved scope | PR #139 delivered the server-authorized atomic RPC path; production migration `20260808175603 finance_linked_ledger_atomic_edit` is live; CREATE/UPDATE/CANCEL smoke with rollback passed. Do not replay the migration. |
| Ledger / reimbursement schema | `APPLICATION_COMPLETE / RUNTIME_FLAG_DISABLED` | Production migration `20260728153000 ledger_reimbursement_workflow` is live. PR #140 added private reimbursement evidence flow and migration `20260809035452 finance_evidence_storage`. Keep `FINANCE_REIMBURSEMENT_ENABLED=false` unless the separate runtime activation gate is explicitly completed. |
| Payroll | `APPLICATION_COMPLETE / BUSINESS_CONFIGURATION_REQUIRED` | Production migration `20260728100414 immutable_monthly_payroll_settlement` is live. PR #141 added readiness and first-month setup boundaries. Production still has no approved first official month and no approved PAYROLL permission recipients; settlement activation must remain off. Do not replay the migration. |
| Email-history safe read/UI | `COMPLETE` for bounded read-only scope | PR #142 moved reads behind a protected server boundary, preserved bounded pagination/search, removed browser hard-delete, and deployed successfully. Archive/retention/retry/dedicated permission design remains `BLOCKED_BY_BUSINESS_DECISION`. |
| Employee Account / Workspace | `STRUCTURALLY_RECONCILED` | PR #143 retained production evidence: 6 active employees, 5 Auth-linked, zero duplicate workspace/permission groups, zero unknown/orphan grants, zero employee/Auth email mismatches. The remaining unlinked Staff profile is an operator onboarding state and must not be auto-invited or auto-granted. |
| Facility | `STRUCTURALLY_RECONCILED / AUTHENTICATED_SMOKE_REQUIRED` | PR #144 retained production evidence: migration `20260723120000 facility_status_code` is live, Facility RLS/grants are structurally correct, and 6/6 active employee assignments resolve. Three assignments remain legacy numeric IDs and require business confirmation before normalization. Keep `FACILITY_ACTIVE_STATE_ENABLED=false` until authenticated Facility/Attendance smoke passes. |
| Dashboard | `APPLICATION_COMPLETE / PRODUCTION_DEPLOY_PENDING` at document creation | PR #145 / commit `4cbf7341...` changes Dashboard grouping from business `month_period` to ledger `created_at` in the operating timezone and excludes cancelled rows. Preview build passed. Production deployment was blocked by Vercel build-rate limiting and production still reported commit `1fd25e0...` immediately before this document was created. The next successful production deployment of `main` must include `4cbf7341...`. |
| Attendance stale-row cancellation | `AUTHENTICATED_LOGOUT_LOGIN_RETEST_REQUIRED` | Existing database/package evidence remains valid. Keep `ATTENDANCE_RECOVERY_ENABLED=false`. Remaining gate requires a real authenticated Staff/Admin smoke; do not synthesize it with database mutation. |
| Employee Profile extension | `BLOCKED_BY_BUSINESS_DECISION` | Existing eight-decision package remains authoritative. No schema promotion. |
| Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | Existing twelve-decision package remains authoritative. No schema/template seed promotion. |
| Email archive/retention/retry | `BLOCKED_BY_BUSINESS_DECISION` | Existing 15-decision package remains authoritative. No archive/delete/retry schema is approved. |
| Transactional email live delivery | `BLOCKED_BY_DEPENDENCY` | Keep `EMAIL_DELIVERY_ENABLED=false`; do not send a real recipient smoke without explicit approval and a verified recipient/configuration. |

## Production invariants retained on 2026-08-09

- Finance business rows were not modified by the Account, Facility, Dashboard, or roadmap reconciliation slices.
- Account reconciliation did not create Auth users, invites, workspace grants, permission grants, or preset assignments.
- Facility reconciliation did not rewrite `employees.branch_code` legacy assignments and did not change Facility RLS/grants.
- Dashboard source reconciliation did not mutate ledger rows or add a database migration.
- No Payroll settlement/configuration, reimbursement activation, Attendance recovery activation, or live email delivery was performed by these reconciliations.

## Operator rule

When this document conflicts with the older 2026-07-31 status table for one of the areas listed above, use this document for current completion/deployment state, while continuing to use the original package/runbook for exact rollback and business-decision constraints.
