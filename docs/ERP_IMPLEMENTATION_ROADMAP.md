# Luminal Factory ERP Implementation Roadmap

## 2026-07-31 consolidated operator status authority

This document is the sole roadmap/status authority. The exact command sequence is
owned by [the current operator handoff](current-operator-handoff.md); package
runbooks supply package-specific commands and predicates only. Repository
presence is not production evidence: none of the packages below is activated or
production `PASS` unless retained evidence is added here after execution.

| Item | Status | Owning PR / commit | Package / runbook and migration prerequisite | Runtime flag | Exact next gate / expected affected rows | Stop conditions | Required validation evidence / rollback |
|---|---|---|---|---|---|---|---|
| Attendance stale-row cancellation | `PRODUCTION_LOGOUT_LOGIN_RETEST_REQUIRED` | PR #100, `b8a8bfb`; the approved forward committed exactly once, post-run passed, and package-wide validation passed. Exactly one Attendance row is cancelled and immutable audit event ID `1` is retained. | Runbook: `docs/attendance-stale-row-cancellation-operator-runbook.md`; migration `supabase/migrations/20260730024246_attendance_cancellation_audit.sql`; Staff display evidence: `docs/attendance-current-shift-state-regression.md`. | Keep `ATTENDANCE_RECOVERY_ENABLED=false`; runtime activation remains separately approval-gated. | Deploy the bounded Staff logout slice, then manually verify logout, protected-route rejection, clean Staff-only login, and the unchanged Maker Lab completed shift; expected Attendance rows affected: 0. | Stop on any session-clear failure, redirect crossover, protected-content restoration, Attendance display regression, duplicate write, Admin denial/bypass, or count drift. | Maker Lab check-in/check-out, duplicate prevention, 16:18â€“16:18 display, raw zero minutes, one converted shift, hidden Start action, and zero payable are `PASS`. Admin Attendance remains read-only. Retain the logout/clean-login result before marking Attendance fully production-complete. Rollback remains separately approval-gated through `supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql` using audit ID `1`. |
| Finance linked-ledger atomic edit | `READY_FOR_LOCAL_OPERATOR` | PR #103, `e82b873`; compensation-safe application fix is on `main`. Sequential compensation is failure-safe but **not true atomicity**. | `docs/finance-linked-ledger-atomic-edit-operator-package.md`; pre-run/forward/rollback `supabase/drafts/20260731_finance_linked_ledger_edit_{pre_run,forward,rollback}.sql`; validation `supabase/validation/20260731_finance_linked_ledger_edit_validation.sql`. Confirm the package on latest `main`; the RPC is prepared and **not executed**. | No new runtime flag; do not wire/use the RPC until validation passes. | Read-only pre-run (0 rows mutated) â†’ approval â†’ `SECURITY INVOKER` RPC DDL (0 business rows) â†’ validation/grants/RLS â†’ wire RPC â†’ CREATE/UPDATE/CANCEL/NONE and forced-failure smoke (counts per runbook; forced failure must persist 0 partial rows). | Stop on any table, column, RLS, policy, ownership, grant, or function invariant failure; stop before wiring on validation failure; stop and roll back on partial persistence or authorization broadening. | Retain pre-run, approval, DDL/post-run, authenticated-only EXECUTE, `security_definer=false`, RLS, four-mode smoke, forced-failure and zero-partial-persistence evidence. Rollback: `supabase/drafts/20260731_finance_linked_ledger_edit_rollback.sql`. |
| Employee Profile extension / salary-field contract | `BLOCKED_BY_BUSINESS_DECISION` | Employee Detail PR #93; decision record PR #94. | `supabase/drafts/20260729_employee_profile_extension_{pre_run,forward,post_run,rollback}.sql`; `supabase/validation/20260729_employee_profile_extension_validation.sql`. | No capability flag may be introduced or enabled. | Approve all eight decisions before promotion: exact field semantics/nullability; Admin per-field read/edit; Staff own-profile per-field read/edit; sensitive visibility; audit allowlist; audit retention; whether old/new sensitive values may be stored; hard deletion versus archive-only. | Stop on any unresolved field, permission, sensitive-data, audit, retention, or deletion decision. Draft review is not mutation approval. | Draft rollback above; destructive promotion/execution is prohibited while blocked. |
| Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | PR #91, `bb3f431`. | `docs/phase-template-business-decision.md` (the authority for the exact twelve decisions); no executable package is approved. | Keep any template capability absent/false. | Business owner answers decisions 1â€“12 exactly as recorded, including ownership/permission, scope/viewers, immutable versions, stage/dependency model, role placeholders, dates, deletion, audit/retention, seeds, and legacy behavior. | Stop while any of the twelve decisions or seed ownership remains unresolved; do not execute the old sketch. | No SQL rollback exists because no executable package is approved; preserve existing project phases/tasks. |
| Ledger/Reimbursement | `READY_FOR_LOCAL_OPERATOR` | PR #81, `362cc68d`; package `20260728153000`. | Pre-run `supabase/drafts/20260728153000_ledger_reimbursement_pre_run.sql`; tracked migration `supabase/migrations/20260728153000_ledger_reimbursement_workflow.sql`; matching validation, smoke, storage, and rollback artifacts. Confirm migration-history absence before delivery. | Keep `FINANCE_REIMBURSEMENT_ENABLED=false` or unset. | After Attendance and finance: read-only pre-run (0 rows mutated), then explicit approval before the package's first mutation; forward counts must equal the package pre-run expectations. | Stop on count drift, public storage, RLS/grant failure, legacy salary mutation, hard delete, idempotency failure, or payroll-source regression. | Retain migration history, pre/post-run, private Storage/RLS, authorization, count and smoke PASS. Rollback: `supabase/rollbacks/20260728153000_ledger_reimbursement_workflow_rollback.sql`; export and separate approval required. |
| Payroll | `READY_FOR_LOCAL_OPERATOR` | PR #80, `6090ace`; package `20260728100414`. | `supabase/drafts/payroll/20260728100414_pre_run.sql`, tracked migration `supabase/migrations/20260728100414_immutable_monthly_payroll_settlement.sql`, matching validation, smoke, and rollback. Confirm migration-history absence before delivery. | Keep `PAYROLL_SETTLEMENT_ENABLED=false` or unset. | Attendance and Facility PASS â†’ read-only pre-run (0 rows mutated) â†’ explicit mutation approval â†’ protected delivery â†’ validation/RLS/authorization â†’ explicit first official month â†’ smoke. Forward counts must equal package expectations. | Stop on legacy-row drift, own-row isolation failure, unauthorized execution, duplicates, mutable originals, missing audit provenance, or unspecified first month. | Retain migration history, pre/post validation, RLS/grants, first-month decision, authorization, immutable/audit, and smoke PASS. Rollback: `supabase/rollbacks/20260728100414_immutable_monthly_payroll_settlement_rollback.sql`; export and destructive-rollback approval required. |
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
`main` or `origin/main` refs, so commit identityâ€”not an unavailable remote refâ€”is
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
| 9. Facility directory | `READY_FOR_OPERATOR` | Repository regression is closed; compatibility, RLS, and pr…8881 tokens truncated…row query, runtime flag change, environment change, email send, deployment, or merge occurred. Attendance Gate 2 remains the exact next operator action; after this newly evidenced defect was resolved, no further item is classified `SAFE_CLOUD_WORK_AVAILABLE`.

## 2026-07-31 â€” Staff Task loader resilience remediation

The current-state rescan supplied bounded Project/Task defect evidence: selecting the first project changed the Staff Task loader callback identity and caused a second initial request; failed manual refreshes still reported success; and repeated refresh clicks could overlap before React committed pending state. The application-only repair uses a functional project selection, a stable loader dependency, a synchronous refresh lock, controlled Vietnamese failure feedback, a persistent stale-data warning with Retry, and a visible pending state. Focused regression coverage protects the request and error-state contracts.

The supplied preparation commit `9bcacfa` is represented on the protected branch by PR #107 and merged repository commit `8836b25`; the remediation is therefore `COMPLETE_ON_MAIN`, not awaiting another hosted pull request. The merged repair removes the duplicate initial Staff Task fetch, prevents refresh false-success and overlapping refresh requests, and preserves stale visible task data when refresh fails. It does not change task assignment, transition, persistence, permission, authorization, or workflow business rules, and it does not reopen any operator package, completed task finding, or decision gate. No SQL, production-row inspection, runtime flag change, live email, deployment, or operator action occurred as part of the remediation delivery. Attendance stale-row cancellation and Finance atomic RPC remain `READY_FOR_LOCAL_OPERATOR`; Employee Profile schema extension, Phase Templates, and email history schema/RLS/archive/retry remain `BLOCKED_BY_BUSINESS_DECISION`. No further item is classified `SAFE_CLOUD_WORK_AVAILABLE`; stop at the existing operator/business-decision boundaries unless new repository or review evidence is supplied.

## 2026-08-01 â€” Attendance stale-row cancellation operator evidence

The Attendance production correction is complete: the approved guarded forward committed exactly once, the repository post-run passed, and package-wide read-only validation passed. Exactly one Attendance row is cancelled, immutable cancellation audit event ID `1` is retained, the employee open-row count is `0`, `check_out`, `total_hours`, and `total_salary` are `NULL`, finalized Payroll references are `0`, and duplicate state count is `0`.

Retained evidence:

- forward: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-forward.txt`
- post-run: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-post-run.txt`
- package validation: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-validation.txt`

`ATTENDANCE_RECOVERY_ENABLED` remains false. Attendance is not fully production-complete: the only remaining Attendance gate is the documented production Staff/Admin smoke. The forward must not be replayed, and rollback remains separately approval-gated using retained audit event ID `1`.

## 2026-08-01 â€” Admin ledger beneficiary and attachment remediation

New source-level defect evidence reopened only the bounded Admin ledger application seam. The page still wrote `financial_ledger` directly from the browser even though the approved RLS contract exposed only Admin `SELECT`; it also rendered `requested_by` as both executor and beneficiary, generated payment QR from that name, and presented attachment copy without an implemented runtime boundary.

The local task branch now routes Admin list/create/update/payment mutations through an authenticated server boundary with `FINANCE_VIEW`, `FINANCE_CREATE`, and `FINANCE_UPDATE`; uses stable beneficiary and payer employee IDs when the existing reimbursement schema gate is active; keeps `requested_by` as legacy executor display compatibility; renders an unresolvable legacy beneficiary as **ChÆ°a xÃ¡c Ä‘á»‹nh**; and derives employee payment QR only from `beneficiary_employee_id`. Create/edit dialogs preserve failed input, use the global loading overlay, lock duplicate submissions synchronously, refresh targeted ledger data, and group transaction, people, payment, and document fields. Existing `bill_url` remains read-only compatibility and is never guessed into a beneficiary.

Private attachment upload/list/signed preview/add/replace/remove plumbing is prepared but fails closed behind both `FINANCE_REIMBURSEMENT_ENABLED` and the new server-only `FINANCE_ATTACHMENT_WRITES_ENABLED` gate. The server also verifies the extended schema and the bucket's private/size/MIME configuration. Replacement uploads and records the new object before archiving and cleaning the old one; removal archives metadata before object cleanup; cleanup failures return a partial `202` result rather than false success. Content signatures, MIME/extension agreement, stable content-addressed paths, target-ledger existence, and duplicate content are checked server-side. The exact private-bucket draft package is `supabase/drafts/20260801_finance_evidence_storage_{forward,rollback}.sql` plus `supabase/validation/20260801_finance_evidence_storage_validation.sql`. It is not promoted or executed. Keep attachment writes disabled until an operator-approved database-atomic active-count invariant and authenticated concurrency/cleanup smoke are complete.

The pre-commit production review removed the sequential compensation path from this Admin API: ordinary one-row edits remain available, while any edit that has or would create a linked counter-row now fails closed until the approved atomic RPC is active. Updates no longer replace creator or idempotency provenance, missing targets return `404`, and schema activation fails with a controlled Vietnamese `503` when readiness is absent. Final local validation passes: lint has no warnings/errors, `npx tsc --noEmit` passes, all 71 test files / 566 tests pass, and the production build passes. No SQL/RPC, migration, Storage policy, live object, runtime flag, legacy row, deployment, commit, push, or pull request was changed. Finance linked-ledger true atomicity remains `READY_FOR_LOCAL_OPERATOR`; Ledger/Reimbursement and private Storage remain `READY_FOR_LOCAL_OPERATOR`; both finance runtime flags stay false/unset. `LIVE_APPROVAL_REQUIRED` applies before any finance RPC, reimbursement migration, private bucket, Storage policy, backfill, or runtime activation.

## 2026-08-01 â€” Attendance fixture hourly-rate administration

The approved interim production-test policy allows one dedicated Attendance fixture
to remain payroll-visible with an exact zero hourly rate and prohibits settlement,
adjustment, reimbursement, real work, and real employee reuse. The bounded local
slice adds hourly-rate editing to Employee Detail â†’ **TÃ i chÃ­nh cÃ¡ nhÃ¢n** through the
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

## 2026-08-01 â€” Production Attendance runtime verification evidence

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

## 2026-08-03 â€” Employee create same-response diagnostic repair

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

## 2026-08-03 â€” Employee create application diagnostic completion and metadata gate

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

## 2026-08-03 â€” Employee create QR-token persistence repair

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
`employee_qr_token_conflict`; both use a safe form message with `MÃ£ QR nhÃ¢n sá»±`
context without revealing the token or database text.

No migration, SQL execution, schema/RLS/Auth/Facility/data mutation, or automatic
production retry belongs to this slice. After protected-main deployment is
verified through `/api/system/version`, the exact next boundary is
`READY_FOR_EMPLOYEE_CREATE_RETRY`: submit the known fixture once manually and
retain the approved safe success/failure fields. Do not mark the Attendance
fixture complete until a created Employee ID and its later fixture gates pass.

## 2026-08-03 â€” Employee Auth email workflow correction

The reported Employee invitation blocker is addressed as a bounded Cloud
application slice. Invite, exact-email existing-account connection, controlled
invite resend, and linked-account password reset now have distinct server-owned
operations and safe structured results. Employee List, Employee Detail, and
Account Management expose the separate connection action and synchronously lock
duplicate requests. Accepted Auth requests are described as acceptedâ€”not as
provider delivery or inbox receiptâ€”and carry a correlation ID. The complete
boundary and remaining operator-only SMTP/allowlist/delivery checks are recorded
in [employee-auth-email-workflow.md](employee-auth-email-workflow.md).

No Employee was created, and no production Auth invitation, password reset,
account link, permission mutation, SQL, or runtime mutation was performed.

## 2026-08-03 â€” Staff authentication entry and Attendance minimum shift correction

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

## 2026-08-04 â€” Attendance multi-check and Admin mutation preparation

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

## 2026-08-04 â€” Shared table infrastructure and Attendance first wave

Status: `READY_FOR_TABLE_LOCAL_LOADING_RETEST`. PR A establishes one presentation-only shared data-table system and migrates Staff Attendance history plus Admin Attendance calendar/daily-modal refresh behavior. Staff mutations continue to patch the authoritative aggregate response with no success GET. Admin manual create/update/cancellation patch the returned row locally, preserving the selected date and modal; month/employee changes remain one scoped GET. Employee, Projects/tasks, and Finance are deliberately deferred to bounded follow-up PRs documented in `shared-data-table-guidance.md`.

No SQL, migration, RLS, runtime gate, recovery action, production Attendance mutation, or manual deployment occurred. Attendance recovery remains disabled.

## 2026-08-04 â€” Admin Attendance manual-entry production blocker

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

## 2026-08-04 â€” Admin Attendance manual-create reason contract

Status: `SUPERSEDED_BY_ADMIN_ATTENDANCE_MUTATION_WIRING_REPAIR`. The earlier
application contract allowed a server-owned default for a short create note.
The current bounded repair aligns the UI and server with the approved audited
contract: create, update, and cancellation each require a trimmed reason of at
least 10 characters. No schema, RLS, permission, runtime-gate, recovery,
payroll, RPC, or production Attendance mutation was performed in that earlier
slice.

## 2026-08-04 â€” Admin Attendance mutation wiring repair

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
