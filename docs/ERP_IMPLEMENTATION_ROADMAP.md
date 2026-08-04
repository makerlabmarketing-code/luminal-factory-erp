# Luminal Factory ERP Implementation Roadmap

## 2026-07-31 consolidated operator status authority

This document is the sole roadmap/status authority. The exact command sequence is
owned by [the current operator handoff](current-operator-handoff.md); package
runbooks supply package-specific commands and predicates only. Repository
presence is not production evidence: none of the packages below is activated or
production `PASS` unless retained evidence is added here after execution.

| Item | Status | Owning PR / commit | Package / runbook and migration prerequisite | Runtime flag | Exact next gate / expected affected rows | Stop conditions | Required validation evidence / rollback |
|---|---|---|---|---|---|---|---|
| Attendance stale-row cancellation | `PRODUCTION_LOGOUT_LOGIN_RETEST_REQUIRED` | PR #100, `b8a8bfb`; the approved forward committed exactly once, post-run passed, and package-wide validation passed. Exactly one Attendance row is cancelled and immutable audit event ID `1` is retained. | Runbook: `docs/attendance-stale-row-cancellation-operator-runbook.md`; migration `supabase/migrations/20260730024246_attendance_cancellation_audit.sql`; Staff display evidence: `docs/attendance-current-shift-state-regression.md`. | Keep `ATTENDANCE_RECOVERY_ENABLED=false`; runtime activation remains separately approval-gated. | Deploy the bounded Staff logout slice, then manually verify logout, protected-route rejection, clean Staff-only login, and the unchanged Maker Lab completed shift; expected Attendance rows affected: 0. | Stop on any session-clear failure, redirect crossover, protected-content restoration, Attendance display regression, duplicate write, Admin denial/bypass, or count drift. | Maker Lab check-in/check-out, duplicate prevention, 16:18–16:18 display, raw zero minutes, one converted shift, hidden Start action, and zero payable are `PASS`. Admin Attendance remains read-only. Retain the logout/clean-login result before marking Attendance fully production-complete. Rollback remains separately approval-gated through `supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql` using audit ID `1`. |
| Finance linked-ledger atomic edit | `READY_FOR_LOCAL_OPERATOR` | PR #103, `e82b873`; compensation-safe application fix is on `main`. Sequential compensation is failure-safe but **not true atomicity**. | `docs/finance-linked-ledger-atomic-edit-operator-package.md`; pre-run/forward/rollback `supabase/drafts/20260731_finance_linked_ledger_edit_{pre_run,forward,rollback}.sql`; validation `supabase/validation/20260731_finance_linked_ledger_edit_validation.sql`. Confirm the package on latest `main`; the RPC is prepared and **not executed**. | No new runtime flag; do not wire/use the RPC until validation passes. | Read-only pre-run (0 rows mutated) → approval → `SECURITY INVOKER` RPC DDL (0 business rows) → validation/grants/RLS → wire RPC → CREATE/UPDATE/CANCEL/NONE and forced-failure smoke (counts per runbook; forced failure must persist 0 partial rows). | Stop on any table, column, RLS, policy, ownership, grant, or function invariant failure; stop before wiring on validation failure; stop and roll back on partial persistence or authorization broadening. | Retain pre-run, approval, DDL/post-run, authenticated-only EXECUTE, `security_definer=false`, RLS, four-mode smoke, forced-failure and zero-partial-persistence evidence. Rollback: `supabase/drafts/20260731_finance_linked_ledger_edit_rollback.sql`. |
| Employee Profile extension / salary-field contract | `BLOCKED_BY_BUSINESS_DECISION` | Employee Detail PR #93; decision record PR #94. | `supabase/drafts/20260729_employee_profile_extension_{pre_run,forward,post_run,rollback}.sql`; `supabase/validation/20260729_employee_profile_extension_validation.sql`. | No capability flag may be introduced or enabled. | Approve all eight decisions before promotion: exact field semantics/nullability; Admin per-field read/edit; Staff own-profile per-field read/edit; sensitive visibility; audit allowlist; audit retention; whether old/new sensitive values may be stored; hard deletion versus archive-only. | Stop on any unresolved field, permission, sensitive-data, audit, retention, or deletion decision. Draft review is not mutation approval. | Draft rollback above; destructive promotion/execution is prohibited while blocked. |
| Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | PR #91, `bb3f431`. | `docs/phase-template-business-decision.md` (the authority for the exact twelve decisions); no executable package is approved. | Keep any template capability absent/false. | Business owner answers decisions 1–12 exactly as recorded, including ownership/permission, scope/viewers, immutable versions, stage/dependency model, role placeholders, dates, deletion, audit/retention, seeds, and legacy behavior. | Stop while any of the twelve decisions or seed ownership remains unresolved; do not execute the old sketch. | No SQL rollback exists because no executable package is approved; preserve existing project phases/tasks. |
| Ledger/Reimbursement | `READY_FOR_LOCAL_OPERATOR` | PR #81, `362cc68d`; package `20260728153000`. | Pre-run `supabase/drafts/20260728153000_ledger_reimbursement_pre_run.sql`; tracked migration `supabase/migrations/20260728153000_ledger_reimbursement_workflow.sql`; matching validation, smoke, storage, and rollback artifacts. Confirm migration-history absence before delivery. | Keep `FINANCE_REIMBURSEMENT_ENABLED=false` or unset. | After Attendance and finance: read-only pre-run (0 rows mutated), then explicit approval before the package's first mutation; forward counts must equal the package pre-run expectations. | Stop on count drift, public storage, RLS/grant failure, legacy salary mutation, hard delete, idempotency failure, or payroll-source regression. | Retain migration history, pre/post-run, private Storage/RLS, authorization, count and smoke PASS. Rollback: `supabase/rollbacks/20260728153000_ledger_reimbursement_workflow_rollback.sql`; export and separate approval required. |
| Payroll | `READY_FOR_LOCAL_OPERATOR` | PR #80, `6090ace`; package `20260728100414`. | `supabase/drafts/payroll/20260728100414_pre_run.sql`, tracked migration `supabase/migrations/20260728100414_immutable_monthly_payroll_settlement.sql`, matching validation, smoke, and rollback. Confirm migration-history absence before delivery. | Keep `PAYROLL_SETTLEMENT_ENABLED=false` or unset. | Attendance and Facility PASS → read-only pre-run (0 rows mutated) → explicit mutation approval → protected delivery → validation/RLS/authorization → explicit first official month → smoke. Forward counts must equal package expectations. | Stop on legacy-row drift, own-row isolation failure, unauthorized execution, duplicates, mutable originals, missing audit provenance, or unspecified first month. | Retain migration history, pre/post validation, RLS/grants, first-month decision, authorization, immutable/audit, and smoke PASS. Rollback: `supabase/rollbacks/20260728100414_immutable_monthly_payroll_settlement_rollback.sql`; export and destructive-rollback approval required. |
| Email-history safe UI/read slice | `READY_FOR_PROTECTED_REVIEW` | Preparation commit supplied as `da8db344611d33635d94154e034ee3971a93cd71`; merged repository equivalent is PR #104, `8787e21`. No hosted PR URL is claimed. | `docs/email-history-business-decision-package.md`; no migration prerequisite for this bounded read/UI slice. | Keep `EMAIL_DELIVERY_ENABLED=false` or unset. | Protected review of field projection, exact-count pagination, bounded search, stale-response/detail handling, controlled errors, and duplicate-delete protection; expected production rows affected: 0. | Stop on actionable review findings, validation failure, or any attempt to infer approval for schema, RLS, archive, deletion, or retry behavior. | Retain protected checks/review outcome. Code rollback is the reviewed commit revert; no database rollback applies. |
| Email-history schema/RLS/archive/retry | `BLOCKED_BY_BUSINESS_DECISION` | No implementation PR or approved commit. | `docs/email-history-business-decision-package.md`; no migration is approved or prepared for execution. | Keep `EMAIL_DELIVERY_ENABLED=false` or unset. | Explicitly approve all 15 recorded business/security choices; expected affected rows before approval: 0. | Stop while any retention, deletion, permission, immutable-audit, identifier, pagination, retry, or idempotency choice is unresolved. | Required evidence is the signed decision record before design. No rollback exists because implementation and mutation are prohibited. |
| ERP transactional email live delivery | `BLOCKED_BY_DEPENDENCY` | PR #95 provides the default-disabled application boundary. | `docs/email-setup.md`; depends on protected review, approved server-only configuration, and explicit one-recipient smoke approval; no SQL migration prerequisite. | Keep `EMAIL_DELIVERY_ENABLED=false` or unset until the documented one-recipient smoke passes. | After dependencies and approval, stop before the first live send; expected live-send count: exactly 1 recipient. | Stop on missing/incorrect server configuration, recipient uncertainty, provider failure, PII/secrets in evidence, or absent smoke approval. | Retain redacted configuration, approval, one-recipient outcome, controlled-error and flag-state evidence. Roll back by disabling the flag and following provider/runbook reversal; never delete history as rollback. |
| Employee Account/Workspace | `READY_FOR_LOCAL_OPERATOR` | Application delivery is recorded in the existing roadmap; no new PR is claimed. | `docs/production-runtime-gate-operator-runbook.md` and the account/workspace entry in `docs/production-operator-sql-handoff.md`; confirm every referenced migration against history. | Keep account/workspace mutations disabled until its authorization gate passes. | Run linkage/catalog/grant fixtures in the registered dependency order; read-only checks affect 0 rows and any grant/revoke mutation must stop for separate approval with the runbook's exact count. | Stop on employee/Auth mismatch, unknown permission acceptance, cross-workspace access, grant drift, or fail-open behavior. | Retain linkage, known/unknown code, authorized/denied grant/revoke, RLS and fail-closed evidence; use the package-specific rollback registered in the SQL handoff. |
| Facility evidence | `READY_FOR_LOCAL_OPERATOR` | PR #83 plus tracked migration `20260723120000`. | `docs/facility-employee-production-compatibility.md`; `supabase/validation/20260727_facility_employee_compatibility_audit.sql`; migration/validation/rollback `20260723120000_facility_status_code_*`. Confirm history before any conditional forward. | Keep `FACILITY_ACTIVE_STATE_ENABLED=false` or unset. | Run read-only compatibility/fixtures first (0 rows mutated); stop before any conditional approved mutation, whose count must match the runbook. | Stop on missing/duplicate codes, active-state mismatch, authorization/RLS failure, count drift, or Attendance regression. | Retain history, compatibility audit, active/inactive, RLS/authorization and Attendance smoke evidence. Rollback: `supabase/rollbacks/20260723120000_facility_status_code_rollback.sql`. |
| Dashboard fixtures | `READY_FOR_LOCAL_OPERATOR` | Dashboard application status is preserved; no activation PR is claimed. | `docs/core-erp-functional-stabilization-report.md` and Dashboard fixture checklist in `docs/production-runtime-gate-operator-runbook.md`; source packages must pass first. | No Dashboard-specific flag; dependent finance, Payroll, and Attendance flags stay disabled. | Retain empty, populated, denied, and error/retry fixtures; expected affected rows: 0. | Stop if evidence requires inventing/mutating production data, exposes raw errors, or disagrees with an authoritative source. | Retain redacted read-only fixture and retry evidence. No data rollback applies because fixtures must not be created. |

### Consolidation corrections

- PR #100 and PR #103 are merged in this repository history; they are not
  pending. PR #103 prepares but does not execute the finance RPC.
- The Attendance cancellation migration ID is `20260730024246`; the separate
  recovery-RLS migration is `20260715073600` and must never be replayed when it
  already appears in migration history.
- The superseded Ledger/storage row in the SQL registry now points to the
  approved `20260728153000` package instead of the older blocked draft.
- All named flags remain false/unset. No production row inspection, SQL/RPC,
  deployment, live email, or automatic merge occurred during consolidation.

## 2026-07-31 post-PR #100 Cloud reconciliation

The repository baseline is `b8a8bfb` (`fix(attendance): align stale cancellation
legacy-total guards (#100)`), the merged PR #100 state. The Cloud task branch is
clean and points directly at that baseline; this checkout does not expose local
`main` or `origin/main` refs, so commit identity—not an unavailable remote ref—is
the reconciliation proof.

PR #100 changed only the Attendance cancellation draft pre-run, guarded forward,
rollback, operator runbook, and focused package test. It did not change
`supabase/migrations/`; the existing tracked cancellation migration
`20260730024246_attendance_cancellation_audit.sql` remains unchanged. Both the
read-only target predicate and both guarded forward predicates accept each
provisional total only when it is `NULL` or exactly zero. Any non-zero
`total_hours` or `total_salary` therefore fails the exact-one target guard and
blocks mutation.

Attendance stale-row cancellation is `READY_FOR_LOCAL_OPERATOR`. No pre-run,
production-row inspection, forward SQL, post-run, package validation,
authenticated Facility/Attendance fixture, runtime-flag change, deployment, or
merge was performed by this Cloud reconciliation. Keep
`ATTENDANCE_RECOVERY_ENABLED` false or unset. The deferred local sequence is:

1. rerun the updated read-only pre-run;
2. confirm exactly one target row;
3. confirm both provisional totals are only zero or `NULL`;
4. run the guarded forward exactly once;
5. run the post-run;
6. run package validation;
7. perform production Staff/Admin smoke.

The 20-item Cloud classification below was re-scanned after applying the user's
priority order. Project/Task, Ledger/Reimbursement, Payroll UI, transactional
email, Account/Permission, Employee Detail, shared stabilization, and Dashboard
application scopes are preserved as complete or operator-gated because the
approved implementations and regression seams already exist. No new concrete
repository defect was found. Consequently no item is currently
`SAFE_CLOUD_WORK_AVAILABLE`; Attendance and the database-dependent packages are
operator-only, Phase Templates and Employee Profile still require business or
security decisions, and broad SaaS/release phases remain dependency-blocked.

## 2026-07-30 Attendance current-shift regression

Fresh production evidence invalidated the prior Attendance application-complete
claim. The Staff page treated a historical unfinished `attendance` row as
today's active shift, displayed an unbounded duration and three provisional
shifts, and did not visibly transition after the attempted checkout.

The repository application correction is `APPLICATION_COMPLETE`: current shift state is explicit,
previous-date open rows are read-only operator warnings, GPS is check-in-only,
successful mutations return and apply persisted state before background refresh,
completed records alone contribute shift units, and the primary action is
compact. Repository validation and the exact recovery boundary are recorded in
[attendance-current-shift-state-regression.md](attendance-current-shift-state-regression.md).

No SQL, runtime activation, production mutation, deployment, Facility Fixture 4
PASS, Facility Fixture 5, or Attendance Gate 2 continuation is claimed. The
existing stale row is `READY_FOR_OPERATOR` under the prepared Attendance
recovery package; `ATTENDANCE_RECOVERY_ENABLED` remains false or unset.

**Reconciled:** 2026-07-29
**Repository baseline:** `bb3f431` (`docs: prepare phase template decision package (#91)`)
**Scope:** repository evidence only. This reconciliation did not execute SQL/RPC, enable a runtime flag, deploy, merge, begin SaaS UI work, or inspect GitHub comments.

## Status contract

This roadmap uses only the following statuses:

- `COMPLETE`: application code, database schema/RPC, runtime activation, and required verification are complete.
- `APPLICATION_COMPLETE`: application code and tests are complete, but no production capability is claimed active.
- `READY_FOR_OPERATOR`: the reviewed forward, rollback, and validation package is complete and ready for the approved operator workflow.
- `LIVE_OPERATOR_VERIFICATION_REQUIRED`: production read-only, migration-history, fixture, smoke, or post-run evidence remains outstanding.
- `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`: repository-safe work is complete and the named live gate can advance only through retained operator production evidence. This status never implies production PASS or runtime activation.
- `RUNTIME_FLAG_DISABLED`: the application and package boundary exists, but its server runtime flag must remain false/unset.
- `BLOCKED_BY_DEPENDENCY`: work cannot safely advance until a named preceding gate passes.
- `BLOCKED_BY_BUSINESS_DECISION`: an approved business or security contract is required before implementation or delivery can advance.
- `DEFERRED`: intentionally outside the current execution sequence.
- `NOT_STARTED`: approved work has not begun.
- `SUPERSEDED`: replaced by a named roadmap item or authority and must not be reopened independently.

Repository presence is not production proof. A migration, draft SQL file, RPC definition, or passing static test does not by itself make a database-dependent feature `COMPLETE`.

## Cloud execution classification

This table is the scheduling authority for the current Cloud continuation. It classifies every roadmap item using only the five requested execution dispositions. `READY_FOR_OPERATOR` includes items whose application work is complete but whose production evidence, protected migration delivery, runtime activation, or live smoke checks belong to an operator. `COMPLETE` means no remaining work exists inside that roadmap item's approved repository scope; it does not promote a linked operator gate to production PASS.

| Roadmap item | Cloud classification | Reason |
|---|---|---|
| 1. Project Membership | `READY_FOR_OPERATOR` | Application and regression scope is complete; retained production role and cancelled-project fixtures remain operator evidence. |
| 2. Project authorization | `READY_FOR_OPERATOR` | Server authorization is implemented; production membership/RLS fixtures remain operator evidence. |
| 3. Project Detail | `COMPLETE` | The approved core detail, state, retry, accessibility, copy, and responsive scope is complete; linked gated mutations remain classified separately. |
| 4. Project atomic create | `READY_FOR_OPERATOR` | The application boundary and complete operator package exist; the runtime flag stays false. |
| 5. Phase Workflow | `READY_FOR_OPERATOR` | The reviewed package and compatibility coverage exist; protected delivery and retained live evidence remain. |
| 6. Phase status mutation | `READY_FOR_OPERATOR` | Migration and validation artifacts exist; activation depends on the operator-verified foundation. |
| 7. Child Task CRUD | `READY_FOR_OPERATOR` | Approved application CRUD is complete; atomic create delivery and smoke evidence remain operator-only. |
| 8. Task comments/activity | `READY_FOR_OPERATOR` | Disabled/error behavior and the complete SQL/RPC/RLS package exist; delivery and activation remain operator-only. |
| 9. Facility directory | `READY_FOR_OPERATOR` | Repository regression is closed; compatibility, RLS, and production fixtures remain operator-only. |
| 10. Attendance | `READY_FOR_OPERATOR` | Preserve `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`; Gate 2 has no further safe Cloud implementation. |
| 11. Employee Account/Workspace | `READY_FOR_OPERATOR` | Application presentation and server boundaries are complete; catalog/linkage/grant fixtures remain operator evidence. |
| 12. Ledger/Reimbursement | `READY_FOR_OPERATOR` | The approved application and complete package `20260728153000` exist; Storage/RLS review, delivery, and smoke evidence remain operator-only. |
| 13. Payroll | `READY_FOR_OPERATOR` | The approved disabled application UI and immutable-settlement package exist; first-month configuration, delivery, fixtures, and activation remain operator-only. |
| 14. Dashboard | `READY_FOR_OPERATOR` | Approved error/retry behavior is complete; empty/populated/denied production fixtures remain operator evidence. |
| 15. Functional stabilization | `COMPLETE` | All approved safe application defect, loading, retry, submission, targeted-refresh, and regression work is complete. |
| 16. Runtime gate readiness | `READY_FOR_OPERATOR` | All seven packages are inventoried and default-disabled; live evidence and activation remain operator-only. |
| 17. Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | The decision package preserves twelve unanswered questions; no implementation or executable package is approved. |
| 18. SaaS UI foundation | `BLOCKED_BY_DEPENDENCY` | The bounded affected journeys and prerequisite operator gates are unresolved; no broad foundation implementation is safe. |
| 19. Broad SaaS UI re-skin | `BLOCKED_BY_DEPENDENCY` | Operational boundaries and runtime evidence remain unresolved. |
| 20. Production hardening | `BLOCKED_BY_DEPENDENCY` | Stabilized production capabilities and an approved UI scope must precede release hardening. |

No item is currently `SAFE_CLOUD_WORK_AVAILABLE`. The exact next safe Cloud item selected for this continuation was this repository reconciliation and operator-handoff correction; it is now `COMPLETE`. No application defect or approved UI/RPC/RLS package gap remained after inspection, so no application code, SQL, runtime flag, deployment, or completed Employee persistence scope was reopened.

### Employee Detail and Employee Profile disposition

- Employee Detail seven-tab application: `APPLICATION_COMPLETE` at completion commit `298fabb`; repository validation: `PASS`.
- Employee Profile schema extension: `BLOCKED_BY_BUSINESS_DECISION`. Package `20260729_employee_profile_extension` remains draft-only and production migration is `NOT_EXECUTED`.
- Employee audit/operator package: `READY_FOR_OPERATOR` for review only. Preserve its pre-run, forward, post-run, rollback, RLS/audit, and validation artifacts without promotion or execution.
- Required decisions: final field semantics/nullability; per-field Admin read/edit; per-field Staff own-profile read/edit; sensitive-field visibility; audit field allowlist; audit retention period; storage of old/new sensitive values; and hard-delete versus archive-only audit retention.
- No production SQL, authenticated production smoke, runtime flag activation, deployment, or merge occurred in this continuation.

After applying the required skips, there is **no exact next `SAFE_CLOUD_WORK_AVAILABLE` item**. The next incomplete operational item is Item 16, Gate 2 Attendance recovery, but it is operator-only. Employee Profile can become the next safe repository slice only after all eight business/security decisions are approved; Phase Templates and the SaaS UI phases retain their existing blockers. This classification prevents Employee Profile from stopping the roadmap while also preventing speculative work.

## Reconciled roadmap

The order below preserves the functional roadmap sequence. Dependency corrections are explicit in **Remaining gate** and in the runtime matrix; they do not duplicate a feature as a second phase.

| Roadmap item | Previous status | Verified status | Evidence | Remaining gate | Next action |
|---|---|---|---|---|---|
| 1. Project Membership | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Membership schema/backfill history and server management/authorization boundaries exist; stable-ID authorization is covered by `tests/project-membership-authorization.test.ts` and `tests/project-membership-management-static.test.ts`. | Production owner/manager/contributor/read-only/cancelled-project fixtures have not been retained as PASS evidence. | Operator runs the membership smoke fixtures in the [production runbook](production-runtime-gate-operator-runbook.md); do not recreate the completed application slice. |
| 2. Project authorization | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Server authorization distinguishes session, employee, membership, dependency, permission, and cancelled-project outcomes in `services/server/projectMembershipAuthorization.ts`; Project Read RLS was recorded as delivered, with some fixture denials deferred. | Verify the remaining production membership/RLS authorization fixtures read-only. | Record operator evidence through the [production runbook](production-runtime-gate-operator-runbook.md); no application reimplementation. |
| 3. Project Detail | `APPLICATION_COMPLETE` | `APPLICATION_COMPLETE` | Core-first loading, server project code, phase metadata, targeted section retries, accessibility/copy slices, and operational-state tests are present in `app/admin/projects/[projectId]/page.tsx`, `tests/project-detail-operational-state.test.ts`, and `tests/project-detail-stepper.test.ts`. | Gated phase/task/comment mutations remain governed by their own linked roadmap items; they are not duplicate Project Detail work. | Preserve this slice; verify linked operator gates rather than scheduling Project Detail again. |
| 4. Project atomic create | `APPLICATION_COMPLETE` | `RUNTIME_FLAG_DISABLED` | Server orchestration and compatibility tests exist; pre-run, forward, post-run, validation, rollback, and backfill artifacts are prepared under `supabase/drafts/20260728_project_creation_atomic_*` and `supabase/drafts/20260721_project_creation_atomic_*`. | Dependencies and RPC privileges/atomicity must pass operator delivery and smoke tests; `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED` remains false/unset. | Follow this gate's card in the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). |
| 5. Phase Workflow | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Normalized workflow foundation forward/rollback/validation/review artifacts are complete under `supabase/drafts/20260718_phase_workflow_foundation_*`; read-only compatibility and rollout tests exist. | Confirm migration history or deliver through the approved path, then retain post-run object/count/RLS and legacy-read evidence. Foundation flag remains false until PASS. | Operator executes the Phase Workflow foundation card in the [activation matrix](runtime-gate-activation-matrix.md) via the [production runbook](production-runtime-gate-operator-runbook.md). |
| 6. Phase status mutation | `READY_FOR_OPERATOR` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Transition validator, membership authorization, status route, promoted migration `supabase/migrations/20260727044729_phase_status_dependency.sql`, validation, pre-run, and rollback artifacts exist with focused tests. | Foundation must be active; migration-history, authorization, dependency, audit, cancelled-project, and post-run checks must PASS. `PHASE_STATUS_MUTATION_ENABLED` remains false. | Operator follows the phase-status card in the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). |
| 7. Child Task CRUD | `APPLICATION_COMPLETE` | `RUNTIME_FLAG_DISABLED` | Normalized task read/edit/status/cancel UI and server contracts exist in `services/server/taskAssignmentFoundation.ts` and project task routes; regression coverage includes `tests/task-assignment-foundation.test.ts` and `tests/task-detail-subtask-binding.test.ts`. | Atomic task-create RPC delivery, privilege validation, atomicity and authorization smoke tests remain; `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` stays false. | Use the exact task-create package in the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md); do not reschedule CRUD implementation. |
| 8. Task comments/activity | `APPLICATION_COMPLETE` | `RUNTIME_FLAG_DISABLED` | Bounded timeline/comment boundary and tests exist in `services/server/projectActivity.ts`, `app/admin/projects/[projectId]/ProjectTimelineSection.tsx`, and `services/projectActivity.test.ts`; full pre/forward/post/rollback artifacts exist under `supabase/drafts/20260728_task_comments_activity_*`. | Operator must deliver and validate immutable history, RLS, actor derivation, bounded reads, and cross-project denial; `TASK_COMMENTS_ACTIVITY_ENABLED` stays false. | Follow the comments/activity gate in the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). |
| 9. Facility directory | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Facility and Employee reads now use the authorized request session instead of requiring a privileged secret; legacy ID/code/name resolution, resilient in-page failures, disabled mutations, focused tests, the tracked status/code migration, and a draft-only scoped read-RLS package exist. The 2026-07-28 focused regression covered Employee List/Detail, Facility List/CRUD, Employee ↔ Facility mapping, legacy values, error/retry states, permissions, navigation, and API contracts with 88 focused assertions passing (`FACILITY_DIRECTORY_REGRESSION_PASS`). | Production compatibility/RLS audit, migration-history/post-run validation, authorized/denied directory fixtures, assigned-facility and inactive-exclusion smoke tests remain; `FACILITY_ACTIVE_STATE_ENABLED` stays false. | Application work is closed and the remaining gate is deferred to the production operator. The operator follows the exact order in [the Facility compatibility report](facility-employee-production-compatibility.md), beginning with read-only audit and running the draft RLS forward only after approval and only if required. |
| 10. Attendance | `APPLICATION_COMPLETE` | `PRODUCTION_CORRECTION_COMPLETE_SMOKE_REQUIRED` | Attendance application work and repository validation are complete. The approved stale-row forward committed once; post-run and package-wide validation passed; exactly one cancelled row and immutable audit event ID `1` are retained with no Payroll reference or duplicate state. Read-only production runtime verification also passed on the approved main commit with recovery disabled. | Dedicated test-fixture provisioning and authenticated production Staff/Admin smoke remain. `ATTENDANCE_RECOVERY_ENABLED` stays false until that documented smoke passes and any later activation receives separate approval. | Do not replay the forward or run rollback. The operator first obtains fixture-provisioning approval, then performs only the remaining smoke through the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). |
| 11. Employee Account/Workspace | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Server-derived account/workspace/preset/permission management and tests exist; reviewed permission catalog forward/validation/rollback artifacts are registered in the operator handoff. | Verify employee/Auth linkage, catalog delta, known/unknown codes, grant/revoke, and fail-closed fixtures before enabling mutations. | Operator runs the account/workspace package from the [production runbook](production-runtime-gate-operator-runbook.md); preserve the completed application UI. |
| 12. Ledger/Reimbursement | `APPLICATION_COMPLETE` | `READY_FOR_OPERATOR` | Approved executor/beneficiary, reimbursement status, server actor/audit, no-delete, idempotency, payroll-source, RLS, attachment metadata, migration and operator packages are complete under identifier `20260728153000`. | Protected-main migration delivery, private Storage/RLS review, post-run authorization/smoke evidence, and separate runtime approval remain. | Operator follows package 8 in the SQL handoff; keep `FINANCE_REIMBURSEMENT_ENABLED` false/unset and preserve every legacy salary row. |
| 13. Payroll | `BLOCKED_BY_BUSINESS_DECISION` | `READY_FOR_OPERATOR` | Approved shift boundaries, attendance aggregation, immutable settlement/adjustment/audit RPCs, own-salary and admin confirmation views, authorization/RLS/grants, runtime gating, and the complete operator package are implemented in `services/server/payroll.ts`, Payroll routes/pages, migration `20260728100414`, and focused regression tests. | Production pre-run, protected-main migration delivery, post-run validation, explicit first-month configuration, permission fixtures, smoke tests, and runtime activation remain operator-only. `PAYROLL_SETTLEMENT_ENABLED` stays false/unset. | Operator follows the Payroll package in the SQL handoff; no historical settlement/backfill, live mutation, flag enablement, deployment, or merge is authorized here. |
| 14. Dashboard | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Server-owned paid-ledger DTO, visible failure, and in-app retry are implemented and covered by `tests/admin-dashboard-dto.test.ts`. | Authorized production fixtures for empty, populated, denied, and error ledger states have not been retained as PASS evidence. | Operator performs the Dashboard read-only smoke checks in the [production runbook](production-runtime-gate-operator-runbook.md); do not redesign it in this task. |
| 15. Functional stabilization | `BLOCKED_BY_DEPENDENCY` | `APPLICATION_COMPLETE` | The current journey matrix and safe application fixes are recorded in [the functional stabilization report](core-erp-functional-stabilization-report.md). Payroll request ordering, duplicate-submit feedback, and Retry state are covered by `tests/payroll-immutable-settlement.test.ts`. | Live operator verification/runtime activation remains for Account, Facility, Attendance, Project Workflow, Child Task create, Comments/Activity, Ledger/Reimbursement, Payroll, and Dashboard. | Safe repository work is complete. Continue with item 16 operator evidence; do not infer any gate active. |
| 16. Runtime gate readiness | `READY_FOR_OPERATOR` | `READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL` | All seven server-owned gates, artifacts, dependencies, smoke tests, activation prerequisites, rollback triggers, and default-false tests are owned by the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). Attendance stale-row correction, post-run, and package validation are `PASS`; read-only production runtime verification passed for commit `e2090766cd6d9193f43ed2006657859b9251647e` with recovery `disabled`; audit event ID `1` is retained. Employee persistence separately records `EMPLOYEE_PROFILE_PERSISTENCE_PASS`. | Attendance requires a dedicated zero-rate test fixture before authenticated Staff/Admin smoke. | **Exact next Attendance gate:** obtain `READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`, then perform production Staff/Admin smoke. Keep `ATTENDANCE_RECOVERY_ENABLED=false`; forward replay and rollback are not authorized. |
| 17. Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | `BLOCKED_BY_BUSINESS_DECISION` | The preserved [business-decision package](phase-template-business-decision.md) defines bounded options and twelve unanswered business questions without creating application code or executable SQL. | The business owner must answer all twelve questions and approve the seed catalog or an empty catalog. | Preserve the package. Do not implement, infer rules, promote draft SQL, or silently approve a contract. |
| 18. SaaS UI foundation | `NOT_STARTED` | `BLOCKED_BY_DEPENDENCY` | `SETUP-CODEX-ERP.md` defines the future shared shell/design-system scope; the stabilization report classifies only a subset of journeys as safe for scoped planning. | Operational gates are unresolved and the approved bounded foundation scope is not isolated from them. | Do not implement yet. Reassess only after the affected journeys and prerequisite operator evidence are explicit. |
| 19. Broad SaaS UI re-skin | `BLOCKED_BY_DEPENDENCY` | `BLOCKED_BY_DEPENDENCY` | The stabilization report explicitly blocks broad redesign while operational boundaries remain unresolved. | Every affected stabilization journey and runtime gate must have the required retained evidence, and the foundation scope must be approved. | Keep broad re-skin blocked; do not reinterpret completed functional polish as a new re-skin slice. |
| 20. Production hardening | `NOT_STARTED` | `BLOCKED_BY_DEPENDENCY` | `SETUP-CODEX-ERP.md` defines performance, accessibility, production build, monitoring, and release-readiness criteria. Existing application slices have local regression/build coverage but no completed release-hardening phase. | Depends on stabilized production capabilities and the approved UI scope; deployment remains a separate approval gate. | Begin only after stabilization and the approved UI phase; do not deploy or merge as part of roadmap reconciliation. |

## 2026-07-29 Employee Profile persistence closure

`EMPLOYEE_PROFILE_PERSISTENCE_PASS`: authenticated production smoke verified Admin updates and hard-refresh readback without changing omitted fields, plus Staff phone and bank updates limited to the authenticated employee. `public.employees` is the authoritative source and both workspaces use the same persistence/readback contract. Mutation success remains distinct from optional enrichment/readback warnings, and workspace notification isolation passed. The Employee Profile persistence incident is **CLOSED**; no SQL, RLS broadening, or runtime flag change was required.

Roadmap reconciliation advances Item 16 to the exact next incomplete item: **Gate 2, Attendance recovery**. Repository-safe review and regression work is allowed; production SQL, runtime activation, and a live PASS claim remain operator-only.

### Attendance Gate 2 repository-safe checkpoint

The normal Staff POST route remains independent from `ATTENDANCE_RECOVERY_ENABLED`: it derives the authenticated employee and server time, inserts check-in, and updates only that employee's open record on check-out. Only Admin recovery is flag-gated, so false/unset preserves normal Staff attendance and read-only Admin use.

The existing pre-run, tracked forward migration, post-run validation, rollback, authorization/RLS, runtime matrix, and smoke runbook were reviewed. The pre-run now checks every required relation and helper, including `shifts` and `current_employee_id()`. Post-run validation now reports helper availability and an explicit zero-row `missing_policy` result. Focused regression coverage binds these artifacts to own-row Staff access, Admin view/manage permissions, non-membership authority, RLS-preserving rollback, and default-disabled recovery.

No further safe Attendance Cloud implementation remains. Attendance application work is `APPLICATION_COMPLETE`, repository validation is `PASS`, and the read-only production runtime verification is `PASS` for the approved main commit with `ATTENDANCE_RECOVERY_ENABLED` normalized to `disabled`. No production SQL or runtime activation occurred, and no live Attendance smoke PASS is claimed.

The remaining operator sequence is exact: (1) verify migration history and do not replay a recorded migration, (2) run the registered Attendance Gate 2 read-only pre-run, (3) retain the registered post-run evidence, (4) obtain dedicated test-fixture provisioning approval and provision only the documented zero-rate fixture, (5) perform authenticated production authorization and smoke checks for own-row Staff access plus authorized and denied Admin fixtures, and (6) keep `ATTENDANCE_RECOVERY_ENABLED=false` until every artifact and check passes.

## 2026-07-28 Payroll settlement checkpoint

Roadmap item 13 is now `READY_FOR_OPERATOR`. The approved contract is implemented as an application and delivery slice: a completed attendance row contributes one to three shifts at the official 180/360-minute boundaries; salary derives from snapshotted worked time and hourly rate; each employee/month has one immutable settlement; corrections are immutable revision rows with server-derived actor/time; and ACTIVE Staff Workspace employees receive only their own salary projection without admin audit details. The first settlement month remains empty until an authorized operator configures it explicitly.

`PAYROLL_SETTLEMENT_ENABLED` must remain false/unset. No SQL/RPC was executed, no historical settlement was generated, no legacy salary/attendance row was rewritten, and no live flag, deployment, or merge occurred. The remaining action is the operator sequence registered in `docs/production-operator-sql-handoff.md`.

**Exact next roadmap item:** Roadmap item 12, Ledger/Reimbursement, remains the earlier incomplete item in roadmap order and is still `BLOCKED_BY_BUSINESS_DECISION`. If that finance/security contract is not approved, there is no additional safe application item; proceed only with retained operator evidence for already packaged gates and do not begin the SaaS UI re-skin.

## 2026-07-28 Facility regression and Attendance continuation checkpoint

`FACILITY_DIRECTORY_REGRESSION_PASS`: the focused repository regression passed without an application regression. The check was intentionally limited to Employee List, Employee Detail, Facility List, Facility CRUD, Employee ↔ Facility mapping, legacy facility values, error/retry states, permissions, navigation, and API contracts. No runtime flag was enabled and no SQL was executed.

Roadmap item 10 Attendance was then resumed without restarting either completed application slice. The safe application review completed explicit in-page retry, visible current-open-shift context, a prior-date stale-shift warning, and a synchronous submission lock that closes the gap before React commits disabled state. Staff access, check-in/out, history, facility display, calculation, permission, API, and default-disabled recovery contracts remain covered and independent from Project Membership. Attendance has therefore reached `LIVE_APPROVAL_REQUIRED`: retained Facility production PASS evidence, Attendance RLS/authorization smoke evidence, and any later flag activation belong to the operator workflow and remain prohibited in this run.

The isolated `npm run build` continuation completed with exit code 0 after compilation, lint/type validation, page-data collection, static generation, and page optimization. The earlier termination is therefore classified as a Codex Cloud timeout/resource termination rather than a Node process termination or an application build error. Attendance remains `APPLICATION_COMPLETE` with `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`; this build result does not claim production activation. `FACILITY_ACTIVE_STATE_ENABLED=false` and `ATTENDANCE_RECOVERY_ENABLED=false` remain the required runtime state.

## Next safe roadmap item

Facility Directory and Attendance are no longer active repository work. Their application slices are closed; Facility remains `LIVE_OPERATOR_VERIFICATION_REQUIRED` and Attendance Gate 2 is `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`. Their remaining gates are deferred to the production operator. `FACILITY_ACTIVE_STATE_ENABLED=false` and `ATTENDANCE_RECOVERY_ENABLED=false` remain mandatory until the operator retains the required PASS evidence.

Applying the required skip rule to production SQL, authenticated production sessions, runtime activation, business approval, and deployment-only evidence leaves **no currently executable safe Cloud roadmap item**. The exact next incomplete item remains **Item 16, Gate 2 — Attendance recovery**, but it is operator-only. Items 12 and 13 are repository-complete packages awaiting operator delivery; items 17–19 remain approval- or dependency-blocked. This continuation therefore does not invent Attendance work, reopen Employee Profile, or jump ahead to SaaS UI or production hardening.

The exact next operational action is the Attendance operator sequence above. The next business action is approval of the bounded [Phase Template decision package](phase-template-business-decision.md); this planning package does not reopen Attendance or authorize Phase Template implementation. New Cloud application work becomes eligible only after retained evidence or an approved scope makes a later dependency-blocked item safe. The bounded scope/dependency boundary for any SaaS UI foundation also remains undecided, and broad re-skin remains blocked. Until then, no SQL, runtime activation, deployment, merge, speculative application work, or SaaS UI re-skin is authorized.

## Seven runtime gates

The authoritative inventory, dependencies, package paths, activation prerequisites, and rollback triggers for all seven gates live in [the runtime-gate activation matrix](runtime-gate-activation-matrix.md). Exact operator commands, evidence capture, smoke tests, monitoring, flag changes, and rollback procedure live in [the production runtime-gate operator runbook](production-runtime-gate-operator-runbook.md).

1. `FACILITY_ACTIVE_STATE_ENABLED`
2. `ATTENDANCE_RECOVERY_ENABLED`
3. `PHASE_WORKFLOW_FOUNDATION_ENABLED`
4. `PHASE_STATUS_MUTATION_ENABLED`
5. `TASK_COMMENTS_ACTIVITY_ENABLED`
6. `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`
7. `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`

Facility/Attendance and Project Workflow are independent roots. Within Project Workflow, Phase foundation precedes Phase status and Comments/Activity; Comments/Activity precedes the two sibling atomic-create gates. This dependency link prevents the completed Project Detail and Child Task application slices from being scheduled again.

## SaaS UI decision

- **Scoped SaaS foundation:** not yet approved for implementation in this roadmap state. A later tightly scoped foundation may be safe for journeys already classified functional, but only after its dependency boundary is explicit and does not cover unresolved operational contracts.
- **Broad SaaS re-skin:** remains `BLOCKED_BY_DEPENDENCY` until functional stabilization reaches final PASS.
- **Current execution boundary:** Facility and Attendance verification is deferred to the production operator. The repository scan reaches the Ledger/Reimbursement business-decision gate and does not begin a SaaS slice.

## Historical status normalization

Earlier batch numbers, corrective slices, and “Phase 1–5 Project Workflow Completion” entries are commit/history labels, not parallel roadmap items. Their delivered application work is incorporated into items 1–16 above and must not be reopened or scheduled independently. The old Phase Template SQL proposal is `DEFERRED` and non-executable; the [current business-decision package](phase-template-business-decision.md) owns approval of scope, permissions, lifecycle, seeds, and compatibility. Phase Templates remain `BLOCKED_BY_BUSINESS_DECISION`. The earlier broad UI-polish phase is `SUPERSEDED` by items 17 and 18. Commit history remains the immutable implementation narrative; this document is the current scheduling authority.

## Rollback

This is a documentation-only reconciliation. Roll back by reverting this document change. No application, schema, RLS, RPC, runtime configuration, production data, or deployment state changed.

## 2026-07-28 Ledger/Reimbursement completion checkpoint

Roadmap item 12 is now `READY_FOR_OPERATOR`. The approved contract is implemented through a default-disabled, server-owned reimbursement capability and migration `20260728153000`: executor/payer and beneficiary are separate, employee and external beneficiary representations coexist, null legacy beneficiaries display **Chưa xác định**, and no legacy salary row is inferred or rewritten. Staff submission and own-record reads are server/RLS constrained; approval, rejection, and payment require finance capabilities; server-derived immutable history, idempotency, no-hard-delete, payroll source identity, attachment metadata, and private-storage design are packaged.

`FINANCE_REIMBURSEMENT_ENABLED` must remain false/unset. No production SQL, storage mutation, runtime activation, legacy backfill, deployment, or merge occurred. The private `finance-evidence` bucket and its server-mediated signed-URL boundary require operator review and delivery before attachment upload is enabled; historical `bill_url` remains render-only compatibility.

**Exact next roadmap item:** Roadmap item 15, Functional stabilization. After the Ledger/Reimbursement operator package and existing operational gates retain PASS evidence, reconcile the 13-journey stabilization matrix to final PASS. Items 17–18 SaaS UI remain blocked and must not start.

## 2026-07-28 Functional stabilization completion checkpoint

Roadmap item 15 is `APPLICATION_COMPLETE`. The repository audit found one active Payroll client-state regression: concurrent month requests could resolve out of order and replace the selected month with stale data. Admin and Staff Payroll now ignore superseded responses; Admin settlement/adjustment actions expose a Vietnamese pending state while the synchronous lock blocks duplicate mutation, and both Payroll views disable Retry while the replacement request is active. Focused coverage was added without changing the approved Payroll calculation, permission, RPC, or immutable-settlement contract.

All safe roadmap application work is complete. This is not a claim that production capabilities are active. The runtime gates remain false/unset: `FINANCE_REIMBURSEMENT_ENABLED`, `FINANCE_ATTACHMENT_WRITES_ENABLED`, `PAYROLL_SETTLEMENT_ENABLED`, `FACILITY_ACTIVE_STATE_ENABLED`, `ATTENDANCE_RECOVERY_ENABLED`, `PHASE_WORKFLOW_FOUNDATION_ENABLED`, `PHASE_STATUS_MUTATION_ENABLED`, `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`, `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`, and `TASK_COMMENTS_ACTIVITY_ENABLED`. No SQL was executed, no flag was enabled, and no deployment or merge occurred.

**Exact next roadmap item:** Item 16 — Runtime gate readiness, specifically operator execution and retained PASS evidence beginning with the independent Gate 1 Facility verification sequence. Item 17 scoped SaaS UI foundation is `PARTIALLY_SAFE` for planning only on journeys already classified functional; implementation was not started. Item 18 broad SaaS UI re-skin remains blocked.

## 2026-07-29 — Employee completeness and transactional email foundation

The explicitly approved Cloud slice is `APPLICATION_COMPLETE`. Employee Detail now uses **Chưa cập nhật** for successfully loaded nullable values, keeps core data visible during optional enrichment failure, retains local retry/no reload, independent dirty-tab saves and read-only permission behavior, and exposes existing contact/banking columns without a schema change. The repository-backed field/permission/dependency classification is owned by [employee-field-inventory.md](employee-field-inventory.md).

ERP transactional email now has a default-disabled server SMTP gate, Admin-authorized single-recipient test action, preview, placeholder blocking, duplicate-submit protection, sanitized correlation/failure logging, and controlled result/toast states. Supabase Auth remains exclusively responsible for authentication mail. No secret, SQL, bulk/automatic send, runtime activation, deployment, or live email was performed. Production activation is `READY_FOR_OPERATOR` under [email-setup.md](email-setup.md).

**Exact next roadmap item:** Item 16, Gate 2 — Attendance recovery operator evidence. The audited stale-row cancellation package is `PACKAGE_READY_FOR_OPERATOR`; production target identity, the expected one-row result, SQL execution, and live PASS remain operator-evidence gated. `ATTENDANCE_RECOVERY_ENABLED` remains false/unset.

## 2026-07-29 — Employee Detail tab completeness clarification

All seven existing Employee Detail tabs were audited without moving domain fields into Overview. Existing project memberships/tasks, current-month attendance, assigned account role, banking, rate and permission sources are now represented in their owning tabs with isolated optional-query warnings and Retry. Unsupported personal/job/audit fields are `SCHEMA_EXTENSION_REQUIRED`; the unexecuted `20260729_employee_profile_extension` pre/forward/post/rollback/validation draft package is `READY_FOR_OPERATOR`. Payroll, reimbursement and Attendance recovery remain runtime/operator-gated and are not simulated.

**Exact next roadmap item:** operator/business review of the Employee Profile schema extension package. Production SQL remains prohibited until the draft semantics, RLS, sensitive-field visibility and audit retention are approved; afterward Item 16 Gate 2 Attendance evidence remains the next existing operational gate.

## 2026-07-29 — Employee Detail completion status reconciliation

The seven-tab Employee Detail application remains `APPLICATION_COMPLETE` and repository validation remains `PASS`; preserve completion commit `298fabb` and the documented tab ownership contract. The schema extension itself is `BLOCKED_BY_BUSINESS_DECISION`, while its non-executable audit/operator package is `READY_FOR_OPERATOR`. Production migration is `NOT_EXECUTED`.

The unresolved contract is deliberately explicit: (1) field semantics/nullability, (2) Admin per-field read/edit, (3) Staff own-profile per-field read/edit, (4) sensitive visibility, (5) audit allowlist, (6) retention period, (7) old/new sensitive-value storage, and (8) hard-delete versus archive-only audit retention. No draft SQL was executed or promoted, no authenticated production smoke ran, no runtime flag changed, and no deployment or merge occurred.

The continuation inspected the remaining roadmap classifications and found no item eligible as `SAFE_CLOUD_WORK_AVAILABLE`. Completed Project Detail, Child Task, Account presentation, Ledger/Reimbursement, Payroll UI, email foundation, loading/retry/empty-state, targeted-refresh, and duplicate-request slices remain closed absent new defect evidence. The exact next incomplete operational action remains operator-owned Attendance Gate 2; the exact next safe Cloud implementation item is **none until a blocker is resolved or new evidence identifies a repository defect**.

## 2026-07-30 — Admin loader stability remediation

Repository validation supplied new defect evidence: lint identified unstable effect dependencies in the transactional email and system-metadata loaders, plus an unbounded native VietQR image. The loaders now use stable callbacks and functional state updates, preserving the current preview/category without capturing stale selection state. The VietQR modal now provides explicit dimensions through the Next.js image boundary. Focused static regression coverage protects these three seams.

This application-only remediation does not reopen any completed business workflow or operator package. No SQL, production-row query, runtime flag change, environment change, email send, deployment, or merge occurred. Attendance Gate 2 remains the exact next operator action; after this newly evidenced defect was resolved, no further item is classified `SAFE_CLOUD_WORK_AVAILABLE`.

## 2026-07-31 — Staff Task loader resilience remediation

The current-state rescan supplied bounded Project/Task defect evidence: selecting the first project changed the Staff Task loader callback identity and caused a second initial request; failed manual refreshes still reported success; and repeated refresh clicks could overlap before React committed pending state. The application-only repair uses a functional project selection, a stable loader dependency, a synchronous refresh lock, controlled Vietnamese failure feedback, a persistent stale-data warning with Retry, and a visible pending state. Focused regression coverage protects the request and error-state contracts.

The supplied preparation commit `9bcacfa` is represented on the protected branch by PR #107 and merged repository commit `8836b25`; the remediation is therefore `COMPLETE_ON_MAIN`, not awaiting another hosted pull request. The merged repair removes the duplicate initial Staff Task fetch, prevents refresh false-success and overlapping refresh requests, and preserves stale visible task data when refresh fails. It does not change task assignment, transition, persistence, permission, authorization, or workflow business rules, and it does not reopen any operator package, completed task finding, or decision gate. No SQL, production-row inspection, runtime flag change, live email, deployment, or operator action occurred as part of the remediation delivery. Attendance stale-row cancellation and Finance atomic RPC remain `READY_FOR_LOCAL_OPERATOR`; Employee Profile schema extension, Phase Templates, and email history schema/RLS/archive/retry remain `BLOCKED_BY_BUSINESS_DECISION`. No further item is classified `SAFE_CLOUD_WORK_AVAILABLE`; stop at the existing operator/business-decision boundaries unless new repository or review evidence is supplied.

## 2026-08-01 — Attendance stale-row cancellation operator evidence

The Attendance production correction is complete: the approved guarded forward committed exactly once, the repository post-run passed, and package-wide read-only validation passed. Exactly one Attendance row is cancelled, immutable cancellation audit event ID `1` is retained, the employee open-row count is `0`, `check_out`, `total_hours`, and `total_salary` are `NULL`, finalized Payroll references are `0`, and duplicate state count is `0`.

Retained evidence:

- forward: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-forward.txt`
- post-run: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-post-run.txt`
- package validation: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-validation.txt`

`ATTENDANCE_RECOVERY_ENABLED` remains false. Attendance is not fully production-complete: the only remaining Attendance gate is the documented production Staff/Admin smoke. The forward must not be replayed, and rollback remains separately approval-gated using retained audit event ID `1`.

## 2026-08-01 — Admin ledger beneficiary and attachment remediation

New source-level defect evidence reopened only the bounded Admin ledger application seam. The page still wrote `financial_ledger` directly from the browser even though the approved RLS contract exposed only Admin `SELECT`; it also rendered `requested_by` as both executor and beneficiary, generated payment QR from that name, and presented attachment copy without an implemented runtime boundary.

The local task branch now routes Admin list/create/update/payment mutations through an authenticated server boundary with `FINANCE_VIEW`, `FINANCE_CREATE`, and `FINANCE_UPDATE`; uses stable beneficiary and payer employee IDs when the existing reimbursement schema gate is active; keeps `requested_by` as legacy executor display compatibility; renders an unresolvable legacy beneficiary as **Chưa xác định**; and derives employee payment QR only from `beneficiary_employee_id`. Create/edit dialogs preserve failed input, use the global loading overlay, lock duplicate submissions synchronously, refresh targeted ledger data, and group transaction, people, payment, and document fields. Existing `bill_url` remains read-only compatibility and is never guessed into a beneficiary.

Private attachment upload/list/signed preview/add/replace/remove plumbing is prepared but fails closed behind both `FINANCE_REIMBURSEMENT_ENABLED` and the new server-only `FINANCE_ATTACHMENT_WRITES_ENABLED` gate. The server also verifies the extended schema and the bucket's private/size/MIME configuration. Replacement uploads and records the new object before archiving and cleaning the old one; removal archives metadata before object cleanup; cleanup failures return a partial `202` result rather than false success. Content signatures, MIME/extension agreement, stable content-addressed paths, target-ledger existence, and duplicate content are checked server-side. The exact private-bucket draft package is `supabase/drafts/20260801_finance_evidence_storage_{forward,rollback}.sql` plus `supabase/validation/20260801_finance_evidence_storage_validation.sql`. It is not promoted or executed. Keep attachment writes disabled until an operator-approved database-atomic active-count invariant and authenticated concurrency/cleanup smoke are complete.

The pre-commit production review removed the sequential compensation path from this Admin API: ordinary one-row edits remain available, while any edit that has or would create a linked counter-row now fails closed until the approved atomic RPC is active. Updates no longer replace creator or idempotency provenance, missing targets return `404`, and schema activation fails with a controlled Vietnamese `503` when readiness is absent. Final local validation passes: lint has no warnings/errors, `npx tsc --noEmit` passes, all 71 test files / 566 tests pass, and the production build passes. No SQL/RPC, migration, Storage policy, live object, runtime flag, legacy row, deployment, commit, push, or pull request was changed. Finance linked-ledger true atomicity remains `READY_FOR_LOCAL_OPERATOR`; Ledger/Reimbursement and private Storage remain `READY_FOR_LOCAL_OPERATOR`; both finance runtime flags stay false/unset. `LIVE_APPROVAL_REQUIRED` applies before any finance RPC, reimbursement migration, private bucket, Storage policy, backfill, or runtime activation.

## 2026-08-01 — Attendance fixture hourly-rate administration

The approved interim production-test policy allows one dedicated Attendance fixture
to remain payroll-visible with an exact zero hourly rate and prohibits settlement,
adjustment, reimbursement, real work, and real employee reuse. The bounded local
slice adds hourly-rate editing to Employee Detail → **Tài chính cá nhân** through the
existing stable employee PATCH route. Server authorization requires both
`EMPLOYEE_MANAGE` and `FINANCE_VIEW`; client and server validation accept zero,
reject negative or malformed values, allow at most two decimal places, and enforce
the existing `numeric(14,2)` storage maximum. Partial updates preserve every omitted
employee field, success refreshes Employee Detail, and structured persistence logs
record actor, target, outcome, and mutation keys without compensation values.

No payroll calculation, schema, migration, RLS, runtime flag, or production data is
changed. After protected-main delivery, stop at
`READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`: the production fixture must be
created, invited, assigned only `STAFF_WORKSPACE` and one verified active facility,
set/read back at zero, and confirmed absent from real project, reimbursement,
pre-existing Attendance, and settlement activity through separately approved Admin
UI actions. The subsequently approved retained smoke row is the sole Attendance
exception. The runbook-verification slice now provides the read-only
`/api/system/version` deployment identity response and the protected normalized
`/api/admin/runtime/attendance-recovery` status response. Production verification
and fixture provisioning remain operator approval boundaries.

## 2026-08-01 — Production Attendance runtime verification evidence

The authoritative production alias is `https://erp.luminalfactory.com`. The
read-only version endpoint returned `success=true`, `status=available`,
`deploymentEnvironment=production`, and approved main commit
`e2090766cd6d9193f43ed2006657859b9251647e` on 2026-08-01 (+07:00). In the same
authenticated Admin browser session with `ADMIN_WORKSPACE` and
`ATTENDANCE_VIEW`, the recovery endpoint returned
`gate=ATTENDANCE_RECOVERY_ENABLED`, normalized `status=disabled`, and safe
correlation ID `bc763507-2dbb-4598-b89f-5f7f8a951429`.

Only redacted endpoint evidence was retained; no raw environment value,
credential, cookie, token, or unrelated deployment metadata was recorded. No
employee, Auth identity, Attendance row, payroll row, SQL, migration,
Supabase/RLS/Storage setting, runtime flag, or deployment was changed. The
Attendance smoke test has not occurred and no fixture has been provisioned.
The exact next boundary is
`READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`.

## 2026-08-03 — Employee create same-response diagnostic repair

Production evidence showed correlation lookup can return unavailable because the
PR #117 implementation stored diagnostics only in a deployment-local process
map. That map is neither durable nor shared across Vercel instances, so the
separate GET endpoint was not a production-reliable evidence path. The endpoint
and map are removed; an allowlisted diagnostic now returns directly in the same
authorized Employee create failure response. Unknown machine values normalize to
`unavailable`, insert and readback stages/codes are distinct, and ambiguous
results instruct exact normalized-email search without automatically retrying.

No shared persistence, dependency, SQL, migration, RLS, environment, deployment,
or production mutation is required. Employee create remains unverified in
production. The metadata-gate section below supersedes the former immediate-retry
boundary: do not retry before the read-only preflight evidence is reviewed.

## 2026-08-03 — Employee create application diagnostic completion and metadata gate

Status: `LIVE_APPROVAL_REQUIRED`. The bounded application slice now returns the
allowlisted Supabase/PostgREST diagnostic in the same authorized POST response,
marks ambiguous readback outcomes explicitly, uses Employee-specific public error
codes, and presents expandable Vietnamese Admin-only technical detail. The removed
instance-local GET lookup remains deprecated and non-authoritative.

Repository inspection cannot prove production compatibility because the original
`public.employees` DDL is absent. The next gate is the zero-mutation read-only
preflight in `supabase/drafts/20260803_employee_create_schema_preflight.sql`, then
its validation file. Do not retry Employee create before the retained metadata
output is reviewed. No forward migration, rollback DDL, production SQL execution,
Employee/Auth/Facility mutation, environment change, or deployment mutation is
part of this slice.

## 2026-08-03 — Employee create QR-token persistence repair

Status: `READY_FOR_PROTECTED_REVIEW`. Approved read-only production metadata
proved `employees.qr_token` is an unsupplied `NOT NULL`/no-default column and the
cause of the `23502` Employee insert rejection. Repository and retained metadata
evidence identify it as the long-lived Attendance check-in credential and prove
the unique constraint `employees_qr_token_key`; no existing generator or tracked
value format was found.

The bounded application slice now generates a cryptographically secure UUID v4
only after Admin authentication and `EMPLOYEE_MANAGE` authorization, adds it to
the Employee insert, excludes it from the public request, normal response,
diagnostics, and values logged by the flow, and retries only a proven QR-token
`23505` collision with a maximum of three server attempts. `23502` maps to
`employee_insert_constraint_failed`; an exhausted QR collision maps to
`employee_qr_token_conflict`; both use a safe form message with `Mã QR nhân sự`
context without revealing the token or database text.

No migration, SQL execution, schema/RLS/Auth/Facility/data mutation, or automatic
production retry belongs to this slice. After protected-main deployment is
verified through `/api/system/version`, the exact next boundary is
`READY_FOR_EMPLOYEE_CREATE_RETRY`: submit the known fixture once manually and
retain the approved safe success/failure fields. Do not mark the Attendance
fixture complete until a created Employee ID and its later fixture gates pass.

## 2026-08-03 — Employee Auth email workflow correction

The reported Employee invitation blocker is addressed as a bounded Cloud
application slice. Invite, exact-email existing-account connection, controlled
invite resend, and linked-account password reset now have distinct server-owned
operations and safe structured results. Employee List, Employee Detail, and
Account Management expose the separate connection action and synchronously lock
duplicate requests. Accepted Auth requests are described as accepted—not as
provider delivery or inbox receipt—and carry a correlation ID. The complete
boundary and remaining operator-only SMTP/allowlist/delivery checks are recorded
in [employee-auth-email-workflow.md](employee-auth-email-workflow.md).

No Employee was created, and no production Auth invitation, password reset,
account link, permission mutation, SQL, or runtime mutation was performed.

## 2026-08-03 — Staff authentication entry and Attendance minimum shift correction

Status: `READY_FOR_PROTECTED_REVIEW`. The dedicated Maker Lab fixture, Staff
check-in/check-out, and duplicate current-shift prevention succeeded in production.
New evidence proved two bounded application defects: Staff routes lacked a shared
unauthenticated entry, and a valid same-minute completed record was excluded from
the minimum finalized shift because its raw/displayed duration was zero.

The application now uses a shared `/login` entry with a safe local return target
and server-owned workspace resolution. Valid completed Attendance uses the
approved 180/360-minute boundaries with a one-shift minimum, while raw duration
and hourly-rate salary remain separate. The completed current-shift card replaces
the write action and exposes shift, timestamps, duration, converted shifts, and
final state. Staff history and every Admin read-only aggregate/detail surface use
the shared dynamic calculation, so no existing-row SQL correction is required.

`ATTENDANCE_RECOVERY_ENABLED` remains false/unset and Admin Attendance remains
read-only. No recovery, SQL, migration, RLS, backfill, Auth/Employee/permission,
runtime, or production data mutation belongs to this slice. Do not mark the
Attendance gate passed until protected-main deployment is verified and the
manual incognito Staff entry plus Staff/Admin converted-shift retest passes.

## 2026-08-04 — Attendance multi-check and Admin mutation preparation

Status: `LIVE_APPROVAL_REQUIRED`. The bounded application contract now supports
the approved same-date/same-shift continuation model: one active aggregate row,
earliest valid check-in, latest valid check-out, elapsed duration including
breaks, and the approved one/ two/ three converted-shift thresholds. The Staff
client applies the returned aggregate row locally, avoiding a second visible
full-loading cycle. Admin manual create/update/delete is independently gated
from recovery, requires `ATTENDANCE_MANAGE` and an adjustment reason, and calls
an audited atomic RPC contract; deletion is a reasoned cancellation.

The application gates remain false/unset. Draft-only SQL prepares an active-row
partial unique index, an RLS-protected operation audit table, and server-owned
Staff/Admin RPCs. No migration, RPC activation, RLS change, backfill, existing
row repair, runtime activation, or production Attendance/Payroll mutation has
occurred. Before any activation, run the read-only preflight, confirm zero
duplicate active Employee/date/shift groups, review the forward/rollback package,
and obtain explicit `LIVE_APPROVAL_REQUIRED` for execution and post-run checks.

## 2026-08-04 — Shared table infrastructure and Attendance first wave

Status: `READY_FOR_TABLE_LOCAL_LOADING_RETEST`. PR A establishes one presentation-only shared data-table system and migrates Staff Attendance history plus Admin Attendance calendar/daily-modal refresh behavior. Staff mutations continue to patch the authoritative aggregate response with no success GET. Admin manual create/update/cancellation patch the returned row locally, preserving the selected date and modal; month/employee changes remain one scoped GET. Employee, Projects/tasks, and Finance are deliberately deferred to bounded follow-up PRs documented in `shared-data-table-guidance.md`.

No SQL, migration, RLS, runtime gate, recovery action, production Attendance mutation, or manual deployment occurred. Attendance recovery remains disabled.

## 2026-08-04 — Admin Attendance manual-entry production blocker

Status: `READY_FOR_OPERATOR_RETEST`. The Admin Attendance payload now keeps the
database `shifts` directory as its configured source and falls back, only when
that directory is empty, to the same morning/afternoon/evening definitions owned
by the Attendance shift resolver. Successful manual create/update/cancellation
patches the returned row into the selected day and closes the modal; validation
and API failures leave the modal and entered values visible. Notification
updates no longer change the GET callback identity, so a mutation toast cannot
trigger a page-wide Attendance reload. Month and Employee filter state remain
untouched.

No SQL, schema, RLS, runtime-gate, RPC, Payroll, audit-contract, or production
Attendance mutation was performed. Operator retest remains required with the
already-approved runtime environment.

## 2026-08-04 — Admin Attendance manual-create reason contract

Status: `SUPERSEDED_BY_ADMIN_ATTENDANCE_MUTATION_WIRING_REPAIR`. The earlier
application contract allowed a server-owned default for a short create note.
The current bounded repair aligns the UI and server with the approved audited
contract: create, update, and cancellation each require a trimmed reason of at
least 10 characters. No schema, RLS, permission, runtime-gate, recovery,
payroll, RPC, or production Attendance mutation was performed in that earlier
slice.

## 2026-08-04 — Admin Attendance mutation wiring repair

Status: `READY_FOR_ADMIN_ATTENDANCE_MUTATION_RETEST`. This bounded application
slice corrects the JSON `employeeId` contract (the UI sends stable
`employees.id`, including numeric values), retains the selected Employee id in
the modal, and validates the active target Employee through the authenticated
server client before the audited mutation RPC. Create, update, and cancellation
now have isolated validation paths; create/update/cancellation reasons are each
validated at 10+ characters as required by the audit contract.

Existing-row save uses dirty check-in/check-out state and patches only the
returned row. Cancellation confirms before calling the existing soft-delete
audit path. Per-row/action locks prevent duplicate requests, legacy log rows
remain explicitly read-only, and recovery remains disabled and independent from
normal Admin mutation.

No SQL, migration, backfill, RLS change, runtime activation, production query,
or production Attendance mutation was performed. Production retest remains
required after deployment with the approved mutation gate and audited RPC.
