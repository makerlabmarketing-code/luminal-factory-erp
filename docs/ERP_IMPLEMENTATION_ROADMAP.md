# Luminal Factory ERP Implementation Roadmap

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
| 10. Attendance | `APPLICATION_COMPLETE` | `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED` | Attendance application work is `APPLICATION_COMPLETE` and repository validation is `PASS`. Normal Staff attendance remains functional and independent from Project Membership; Staff Portal access, check-in/out, current open shift, history, facility display, load/error/retry states, stale-shift warning, synchronous double-submit locking, and shift calculations have focused coverage. The repository-safe Gate 2 package is complete. | Live Gate 2 has no retained production PASS: verify migration history, run the read-only pre-run, retain post-run evidence, and complete authenticated production authorization and smoke checks. `ATTENDANCE_RECOVERY_ENABLED` stays false/unset until every result passes. | Do not perform more Attendance implementation without a concrete repository defect. The operator follows the exact evidence order in the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md); no SQL execution or flag activation is authorized by this status. |
| 11. Employee Account/Workspace | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Server-derived account/workspace/preset/permission management and tests exist; reviewed permission catalog forward/validation/rollback artifacts are registered in the operator handoff. | Verify employee/Auth linkage, catalog delta, known/unknown codes, grant/revoke, and fail-closed fixtures before enabling mutations. | Operator runs the account/workspace package from the [production runbook](production-runtime-gate-operator-runbook.md); preserve the completed application UI. |
| 12. Ledger/Reimbursement | `APPLICATION_COMPLETE` | `READY_FOR_OPERATOR` | Approved executor/beneficiary, reimbursement status, server actor/audit, no-delete, idempotency, payroll-source, RLS, attachment metadata, migration and operator packages are complete under identifier `20260728153000`. | Protected-main migration delivery, private Storage/RLS review, post-run authorization/smoke evidence, and separate runtime approval remain. | Operator follows package 8 in the SQL handoff; keep `FINANCE_REIMBURSEMENT_ENABLED` false/unset and preserve every legacy salary row. |
| 13. Payroll | `BLOCKED_BY_BUSINESS_DECISION` | `READY_FOR_OPERATOR` | Approved shift boundaries, attendance aggregation, immutable settlement/adjustment/audit RPCs, own-salary and admin confirmation views, authorization/RLS/grants, runtime gating, and the complete operator package are implemented in `services/server/payroll.ts`, Payroll routes/pages, migration `20260728100414`, and focused regression tests. | Production pre-run, protected-main migration delivery, post-run validation, explicit first-month configuration, permission fixtures, smoke tests, and runtime activation remain operator-only. `PAYROLL_SETTLEMENT_ENABLED` stays false/unset. | Operator follows the Payroll package in the SQL handoff; no historical settlement/backfill, live mutation, flag enablement, deployment, or merge is authorized here. |
| 14. Dashboard | `APPLICATION_COMPLETE` | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Server-owned paid-ledger DTO, visible failure, and in-app retry are implemented and covered by `tests/admin-dashboard-dto.test.ts`. | Authorized production fixtures for empty, populated, denied, and error ledger states have not been retained as PASS evidence. | Operator performs the Dashboard read-only smoke checks in the [production runbook](production-runtime-gate-operator-runbook.md); do not redesign it in this task. |
| 15. Functional stabilization | `BLOCKED_BY_DEPENDENCY` | `APPLICATION_COMPLETE` | The current journey matrix and safe application fixes are recorded in [the functional stabilization report](core-erp-functional-stabilization-report.md). Payroll request ordering, duplicate-submit feedback, and Retry state are covered by `tests/payroll-immutable-settlement.test.ts`. | Live operator verification/runtime activation remains for Account, Facility, Attendance, Project Workflow, Child Task create, Comments/Activity, Ledger/Reimbursement, Payroll, and Dashboard. | Safe repository work is complete. Continue with item 16 operator evidence; do not infer any gate active. |
| 16. Runtime gate readiness | `READY_FOR_OPERATOR` | `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED` | All seven server-owned gates, artifacts, dependencies, smoke tests, activation prerequisites, rollback triggers, and default-false tests are owned by the [activation matrix](runtime-gate-activation-matrix.md) and [production runbook](production-runtime-gate-operator-runbook.md). Attendance repository validation is `PASS`; Employee persistence separately records `EMPLOYEE_PROFILE_PERSISTENCE_PASS`. | Live Attendance Gate 2 still needs migration-history verification, read-only pre-run output, retained post-run output, and authenticated production authorization/smoke evidence. | **Exact next incomplete item:** Gate 2, Attendance recovery, owned by the production operator. Keep `ATTENDANCE_RECOVERY_ENABLED=false` until all evidence passes; no safe Cloud application work remains for this gate. |
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

No further safe Attendance Cloud implementation remains. Attendance application work is `APPLICATION_COMPLETE`, repository validation is `PASS`, and live Gate 2 is `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`. `ATTENDANCE_RECOVERY_ENABLED` is false/unset and must stay that way. No production SQL, runtime activation, or authenticated production verification occurred, so no live Attendance PASS is claimed.

The remaining operator sequence is exact: (1) verify migration history and do not replay a recorded migration, (2) run the registered Attendance Gate 2 read-only pre-run, (3) retain the registered post-run evidence, (4) perform authenticated production authorization and smoke checks for own-row Staff access plus authorized and denied Admin fixtures, and (5) keep `ATTENDANCE_RECOVERY_ENABLED=false` until every artifact and check passes.

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

All safe roadmap application work is complete. This is not a claim that production capabilities are active. The nine requested gates remain false/unset: `FINANCE_REIMBURSEMENT_ENABLED`, `PAYROLL_SETTLEMENT_ENABLED`, `FACILITY_ACTIVE_STATE_ENABLED`, `ATTENDANCE_RECOVERY_ENABLED`, `PHASE_WORKFLOW_FOUNDATION_ENABLED`, `PHASE_STATUS_MUTATION_ENABLED`, `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`, `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`, and `TASK_COMMENTS_ACTIVITY_ENABLED`. No SQL was executed, no flag was enabled, and no deployment or merge occurred.

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
