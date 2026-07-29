# Production Operator SQL Handoff

## Atomic normalized child-task creation

- **Status:** `READY_FOR_OPERATOR`
- **Affected objects:** `public.create_project_task_atomic(...)`; reads/writes existing `public.tasks`, `public.task_comments`, `public.project_activity`, and `public.task_notifications`.
- **Expected row-count effect during rollout:** zero. The forward DDL only creates/replaces a function. Each later successful application call creates exactly one task, one activity row, zero-or-one comment, and zero-or-one assignment notification.
- **Authorization/RLS impact:** the function is `SECURITY INVOKER`. Revoke `PUBLIC`, `anon`, and `authenticated`; grant execution only to `service_role`. Application authorization remains server-derived before the RPC call. Existing table RLS remains unchanged.

### Exact order

1. Keep `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` unset or `false`.
2. Run `supabase/drafts/20260728_task_assignment_atomic_create_pre_run.sql` read-only and retain the output. Stop if any required table is missing or the existing signature is unexpected.
3. Review and deliver `supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql` through the protected migration workflow, adding explicit function EXECUTE revokes/grant in the promoted migration.
4. Run `supabase/drafts/20260728_task_assignment_atomic_create_post_run.sql`. PASS requires invoker security, no anon/authenticated execute, and service-role execute.
5. Enable `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=true` only in the server runtime.
6. Run the smoke tests below with an authorized fixture project, then an unauthorized/cross-project fixture.

### Smoke tests

- Authorized Project Owner or Project Manager creates a task in an unlocked phase; exactly one task and one `TASK_CREATED` activity appear.
- Optional initial comment and assignment create at most one related row each.
- ACTIVE project-member assignee is accepted by employee ID; inactive/non-member and cross-project phase IDs are rejected.
- Contributor and cancelled-project mutations are rejected according to server capabilities.
- Double click produces one request because the dialog is disabled while saving.
- Failed RPC leaves no partial task, comment, activity, or notification rows.

### Rollback

- **Artifact:** `supabase/drafts/20260728_task_assignment_atomic_create_rollback.sql`.
- **Trigger:** privilege validation fails, atomicity smoke test fails, authorization bypass is observed, or the RPC result cannot be confirmed.
- Disable the runtime flag first, run rollback through the approved operator path, and retain historical rows. Never hard-delete created tasks as part of rollback.

## Facility production data verification

- **Status:** `LIVE_OPERATOR_VERIFICATION_REQUIRED`
- Preserve the existing facility audit and reconciliation artifacts. Do not mutate live facility or attendance rows from Cloud.

## Phase Workflow production capability

- **Status:** `LIVE_OPERATOR_VERIFICATION_REQUIRED`
- Preserve the existing capability gate until operator validation confirms the promoted workflow migration and post-run checklist.

## Ordered production package register

This register is the operator order. A later package must not be activated before every dependency reports PASS. Cloud prepared these artifacts only; it did not execute SQL, deploy, mutate data, or enable flags.

| Order | Package | Status | Dependency | Pre-run | Forward | Post-run | Rollback | Objects / expected rollout row change | Authorization / RLS | Runtime flag | Smoke test / rollback trigger |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Facility compatibility/read audit | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | None | `supabase/validation/20260727_facility_employee_compatibility_audit.sql` | `supabase/migrations/20260723120000_facility_status_code.sql` (already tracked; do not rerun outside migration history) | `supabase/validation/20260723120000_facility_status_code_validation.sql` | `supabase/rollbacks/20260723120000_facility_status_code_rollback.sql` | `facilities.code`, `facilities.is_active`; validation 0, backfill count must equal reported missing-code rows | Existing facility server authorization; no browser write policy | Keep `FACILITY_ACTIVE_STATE_ENABLED=false` until PASS | Resolve assigned facility and inactive exclusion; rollback on duplicate/null codes or Attendance regression |
| 2 | Phase Workflow | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Facility audit is independent but should be recorded first | `supabase/drafts/20260718_phase_workflow_foundation_pre_run_readonly_validation.sql` | `supabase/drafts/20260718_phase_workflow_foundation_final_forward.sql` | `supabase/drafts/20260718_phase_workflow_foundation_final_validation.sql` | `supabase/drafts/20260718_phase_workflow_foundation_final_rollback.sql` | `phases`, workflow constraints/functions; expected counts use the attached pre-run report | Project-member read, manager mutation, server-derived actor | Keep existing Phase Workflow flags false | Read project phases, reject cross-project/status bypass; rollback on count mismatch, RLS bypass, or legacy read regression |
| 3 | Task Assignment atomic create | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Task Assignment tables and Phase Workflow objects PASS | `supabase/drafts/20260728_task_assignment_atomic_create_pre_run.sql` | `supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql` | `supabase/drafts/20260728_task_assignment_atomic_create_post_run.sql` | `supabase/drafts/20260728_task_assignment_atomic_create_rollback.sql` | Atomic RPC; rollout 0 rows, each successful call exactly 1 task/activity and 0–1 comment/notification | Security invoker; service-role execute only; app performs session authorization | Keep `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=false` | Authorized create is atomic; reject inactive member/cross-project phase; rollback on partial write or execute grant failure |
| 4 | Task Comments and Project Activity | `READY_FOR_OPERATOR` | Task Assignment foundation tables PASS | `supabase/drafts/20260728_task_comments_activity_pre_run.sql` | `supabase/drafts/20260728_task_comments_activity_forward.sql` | `supabase/drafts/20260728_task_comments_activity_post_run.sql` | `supabase/drafts/20260728_task_comments_activity_rollback.sql` | `task_comments`, `project_activity`, immutable triggers; rollout 0 rows | Authenticated SELECT through project access; browser mutations revoked; actor server-derived | Keep `TASK_COMMENTS_ACTIVITY_ENABLED=false` | Add project/task comment, bounded read, reject cross-project/client actor/update/delete; rollback on privilege or immutability failure |
| 5 | Phase Templates | `BLOCKED_BY_BUSINESS_DECISION` | Phase Workflow PASS and approved template-management permission code | Not yet approved | Not yet approved | Not yet approved | Not yet approved | Proposed template/header/item/default-task tables; row changes unknown until seed decision | Admin/project-management write; active-template staff read; server actor | Keep any template capability flag absent/false | Gate remains until seed ownership and permission decision are approved; do not run a draft |
| 6 | Attendance recovery | `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED` | Facility verification PASS | `supabase/drafts/20260728_attendance_recovery_pre_run.sql` | `supabase/migrations/20260715073600_attendance_recovery_rls.sql` (tracked; verify migration history and never replay when recorded) | `supabase/validation/20260715073600_attendance_recovery_rls_validation.sql` | `supabase/rollbacks/20260715073600_attendance_recovery_rls_rollback.sql` | Attendance recovery RLS boundary; rollout 0 rows | Server route requires Admin Workspace + `ATTENDANCE_MANAGE`; own attendance remains independent of membership | Keep `FACILITY_ACTIVE_STATE_ENABLED=false` and `ATTENDANCE_RECOVERY_ENABLED=false` until migration-history, retained pre/post, authorization/RLS, and authenticated smoke evidence passes | Own check-in/out, current/stale open-shift state, history, facility label, failure/retry, and submission locking remain usable; test authorized and denied production fixtures; admin UI stays read-only while disabled; rollback on own-row access regression or authorization bypass |
| 7 | Workspace permissions | `LIVE_OPERATOR_VERIFICATION_REQUIRED` | Employee/Auth linkage verified | `supabase/drafts/20260722_corrective_slice_5_permission_catalog_validation.sql` | `supabase/drafts/20260722_corrective_slice_5_permission_catalog_forward.sql` | same validation after forward | `supabase/drafts/20260722_corrective_slice_5_permission_catalog_rollback.sql` | Permission catalog/grants; expected catalog delta from validation report, no employee grants during rollout | Admin-only server mutations; reject unknown codes; preserve audit | Keep permission mutation capability disabled until PASS | Grant/revoke fixtures and fail-closed unknown code; rollback on catalog mismatch or authorization bypass |
| 8 | Ledger/storage | `BLOCKED_BY_BUSINESS_DECISION` | Finance category/beneficiary and storage-bucket policy approval | `supabase/drafts/20260721_finance_expense_workflow_validation.sql` | `supabase/drafts/20260721_finance_expense_workflow_forward.sql` | same validation after forward | `supabase/drafts/20260721_finance_expense_workflow_rollback.sql` | Financial ledger/reimbursement/storage metadata; expected rows depend on approved legacy mapping | Finance server boundary, immutable business history, private attachment policies | Keep new ledger/storage capability disabled | Executor differs from beneficiary, existing receipt reads, no hard delete; rollback on legacy salary or attachment access regression |
| 9 | Payroll | `READY_FOR_OPERATOR` | Attendance/facility verification PASS and protected migration approval | `supabase/drafts/payroll/20260728100414_pre_run.sql` | `supabase/migrations/20260728100414_immutable_monthly_payroll_settlement.sql` | `supabase/validation/20260728100414_immutable_monthly_payroll_settlement_validation.sql` | `supabase/rollbacks/20260728100414_immutable_monthly_payroll_settlement_rollback.sql` | Configuration, immutable settlements, adjustments, audit, and RPCs; rollout creates schema/catalog rows only and **zero settlements** | Own-row Staff Workspace reads; payroll permissions for admin RPCs; server-derived actor/time; direct writes revoked | Keep `PAYROLL_SETTLEMENT_ENABLED=false` until all PASS evidence and explicit first-month configuration | Follow `supabase/drafts/payroll/20260728100414_smoke_test_checklist.md`; rollback runtime on isolation/immutability/duplicate/audit failure |

### Global rollout stop conditions

Stop and roll back or leave the relevant runtime flag disabled when object/constraint checks fail, expected counts differ, an authenticated browser can mutate protected history, cross-project access succeeds, an atomic operation partially persists, existing Attendance/legacy salary reads regress, or a smoke test exposes raw database errors. Rollback never hard-deletes business history.

## Core ERP stabilization activation boundary (2026-07-28)

The functional stabilization audit does not change package order or authorize execution. `docs/core-erp-functional-stabilization-report.md` is the current journey-level readiness record. Keep every listed server runtime gate false/unset until its existing pre-run, forward delivery, post-run, authorization, RLS, regression, and smoke-test prerequisites report PASS.

Broad SaaS UI re-skin remains blocked until Account/Permissions, Facility, Attendance, Phase Workflow, Child Task create, Comments/Activity, Ledger, and Payroll rows in that report are ready. Payroll is `READY_FOR_OPERATOR` but remains runtime-disabled pending its registered delivery and smoke evidence; Ledger/reimbursement/storage remains blocked on the recorded finance business decisions.

## Runtime gate operator-readiness addendum (2026-07-28)

`docs/runtime-gate-activation-matrix.md` now owns the seven-gate artifact inventory and authoritative dependency graph. `docs/production-runtime-gate-operator-runbook.md` owns exact execution, smoke, flag, monitoring, and rollback steps. The audit added read-only pre-run files for phase status, project atomic create, and Attendance recovery; a project atomic post-run privilege check; and hardened `create_project_atomic(jsonb)` to service-role execution only.

The authoritative graph has independent Facility/Attendance and Project Workflow roots. Within Project Workflow, Phase foundation precedes phase status and comments/activity; comments/activity precedes both atomic-create RPC gates. The two create gates are siblings. No SQL/RPC was executed and every flag remains false/unset.


## Immutable monthly payroll settlement

- **Status:** `READY_FOR_OPERATOR`; production execution is not authorized by this handoff.
- **Official calculation:** completed durations `>0–180` minutes = 1 shift, `181–360` = 2, and `>360` = 3. Salary uses snapshot worked hours × snapshot hourly rate.
- **Settlement:** the unique employee/month constraint and immutable trigger prevent duplicate or overwritten originals. Adjustments preserve the base settlement and require amount, reason, server-derived actor, and server timestamp.
- **First month:** no default and no backfill exist. An authorized `PAYROLL_CONFIGURE` operator must explicitly call `configure_payroll_first_month('YYYY-MM-01')` after validation.
- **Authorization:** Staff Workspace reads only the current employee through `get_my_monthly_payroll`; payroll operators use `PAYROLL_VIEW`, `PAYROLL_SETTLE`, `PAYROLL_ADJUST`, and `PAYROLL_CONFIGURE`. Direct authenticated mutation is revoked and RLS protects table reads.
- **Runtime:** keep `PAYROLL_SETTLEMENT_ENABLED=false` until pre-run, protected migration delivery, post-run, grants, authorized/denied fixtures, immutable/duplicate smoke tests, and explicit first-month configuration pass.
- **Rollback:** disable runtime first. SQL rollback drops payroll objects and is destructive, so export and approval are mandatory. It never edits legacy attendance or historical salary rows.

## Package 8 update — Ledger/Reimbursement approved

Status: `READY_FOR_OPERATOR` / `LIVE_APPROVAL_REQUIRED`. Use pre-run `supabase/drafts/20260728153000_ledger_reimbursement_pre_run.sql`, forward `supabase/migrations/20260728153000_ledger_reimbursement_workflow.sql`, post-run `supabase/validation/20260728153000_ledger_reimbursement_validation.sql`, rollback `supabase/rollbacks/20260728153000_ledger_reimbursement_workflow_rollback.sql`, private-storage design `supabase/drafts/20260728153000_ledger_storage_policy.md`, and smoke checklist `supabase/drafts/20260728153000_ledger_reimbursement_smoke.md`.

Keep `FINANCE_REIMBURSEMENT_ENABLED=false` or unset until forward delivery, post-run schema/RPC/RLS validation, private bucket/server signed-URL review, authorization fixtures, idempotency, immutable history, no-delete, legacy salary, existing attachment, storage-error, and payroll-source smoke checks all pass. Rollback drops new workflow data and therefore requires export/approval; it never backfills or rewrites legacy salary rows.
