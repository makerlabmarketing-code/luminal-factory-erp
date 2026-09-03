# Runtime Gate Activation Matrix

**Prepared:** 2026-08-01; Task Assignment evidence reconciled 2026-08-16
**Scope:** operator readiness and retained production evidence. Task Assignment's
catalog-only migration and read-only validation now pass in production; no live
fixture row was created and every runtime flag remains false/unset. Other gate
claims remain unchanged.

## Safety contract

All runtime flags are server-owned and default closed: only the exact server value `true` enables a capability. Browser environment variables, request payloads, actor IDs, roles, and client-supplied capability fields never grant authority. Operators must disable a flag before rollback. A package is `READY_FOR_OPERATOR` when its repository artifacts are complete; `LIVE_OPERATOR_VERIFICATION_REQUIRED` means a tracked package may already be in migration history and its live state must be verified rather than replayed. Attendance uses the more explicit `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED` for the remaining migration-history, authorization, fixture, and smoke evidence; its read-only deployment identity and recovery-status checks are now verified PASS and do not activate the gate.

## Authoritative dependency graph

The schema/RPC references produce three independent roots; the previously suggested single linear order is not authoritative.

```text
FACILITY_ACTIVE_STATE_ENABLED
└── ATTENDANCE_RECOVERY_ENABLED

PHASE_WORKFLOW_FOUNDATION_ENABLED
├── PHASE_STATUS_MUTATION_ENABLED
├── TASK_COMMENTS_ACTIVITY_ENABLED
│   ├── PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED
│   └── TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED
└── (read-only phase display; available while both phase flags are false)
```

Project atomic create and task atomic create are siblings: both require normalized Phase Workflow tables and the hardened comments/activity objects, but neither requires the other. Phase status mutation also does not gate either create RPC. Facility is independent of project workflow. Attendance recovery depends on facility validation because attendance location assignment must be verified before administrative repair is enabled.

**Safe operator order:** (1) facility read-only audit and active-state verification, (2) Attendance recovery; independently, (3) Phase Workflow foundation, (4) phase status mutation and comments/activity hardening, in either order after foundation, then (5) project atomic create and (6) task atomic create, in either order after comments/activity. For a single serial run, use 1 → 2 → 3 → 4 → 5 → 6 as listed in the operator runbook; dependency siblings are ordered to simplify evidence capture, not because an artificial dependency exists.

## Gate matrix

| Gate | Purpose / affected feature | Default | Database objects | RPC / functions | RLS / policies and grants | Package files (pre → forward → post → rollback) | Smoke tests | Activation prerequisite | Rollback trigger | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `FACILITY_ACTIVE_STATE_ENABLED` | Persist stable facility codes and active state; Facility administration and Attendance facility matching. | false/unset | `facilities.code`, `facilities.is_active`, unique normalized code and active index | None | Existing Admin server authorization; no browser write grant is introduced. | `supabase/validation/20260727_facility_employee_compatibility_audit.sql` → `supabase/migrations/20260723120000_facility_status_code.sql` → `supabase/validation/20260723120000_facility_status_code_validation.sql` → `supabase/rollbacks/20260723120000_facility_status_code_rollback.sql` | Read directory; resolve assigned facility by stable code/name; exclude inactive facility from new Attendance matching; unauthorized browser write rejected; disabled UI shows “Chức năng cập nhật cơ sở đang chờ kích hoạt.” | Compatibility audit and post-run validation PASS with expected backfill count; assigned and inactive facility fixtures PASS. | Duplicate/null code, count mismatch, facility read regression, inactive facility accepted, or browser mutation. | `LIVE_OPERATOR_VERIFICATION_REQUIRED` |
| `PHASE_WORKFLOW_FOUNDATION_ENABLED` | Use normalized durable phase metadata while retaining phase display; Project Detail phase display. | false/unset | `phases` normalized columns/constraints and supporting task/history tables described by the reviewed foundation package | Foundation helper functions in forward package | Project-member reads; manager mutation boundary; browser writes remain policy constrained; server-derived actor. | `supabase/drafts/20260718_phase_workflow_foundation_pre_run_readonly_validation.sql` → `supabase/drafts/20260718_phase_workflow_foundation_final_forward.sql` → `supabase/drafts/20260718_phase_workflow_foundation_final_validation.sql` → `supabase/drafts/20260718_phase_workflow_foundation_final_rollback.sql` | Legacy and normalized projects render phases; locked/read-only phases remain selectable; cross-project read/write rejected; no raw schema error. | Pre-run report retained, approved delivery completes, post-run object/count/RLS checks and legacy phase-read regression PASS. | Count mismatch, orphan/duplicate phase, RLS bypass, legacy read regression, raw database error. | `LIVE_OPERATOR_VERIFICATION_REQUIRED` |
| `PHASE_STATUS_MUTATION_ENABLED` | Atomic validated phase transitions, dependencies, and audit; Project Detail phase actions. | false/unset; effective only when foundation is true | `phases.status`, dependency/lock columns, `phase_status_history` | `transition_project_phase_status(...)` | History project-view SELECT policy; browser EXECUTE and history mutation revoked; service-role RPC execution only; application membership authorization. | `supabase/drafts/20260728_phase_status_dependency_pre_run.sql` → `supabase/migrations/20260727044729_phase_status_dependency.sql` → `supabase/validation/20260727044729_phase_status_dependency_validation.sql` → `supabase/drafts/20260721_phase_status_dependency_rollback.sql` | Valid transition writes one audit row; stale status, unmet dependency, cross-project actor, contributor, and cancelled-project attempts fail; read-only phase display remains when disabled. | Foundation active; migration-history delivery confirmed; validation and authorization/dependency/audit fixtures PASS. | Browser EXECUTE, missing audit, invalid transition succeeds, dependency bypass, count mismatch, or phase display regression. | `LIVE_OPERATOR_VERIFICATION_REQUIRED` |
| `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED` | Create project, owner/manager membership, phases, tasks, comments/activity and notifications in one transaction; Project create modal. | false/unset | `projects.project_code`; `project_members`, `phases`, `tasks`, `task_comments`, `project_activity`, `task_notifications` | `create_project_atomic(jsonb)` | `SECURITY INVOKER`; PUBLIC/anon/authenticated EXECUTE revoked; service-role only; Admin Workspace + `PROJECT_MANAGE` server authorization. | `supabase/drafts/20260728_project_creation_atomic_pre_run.sql` → `supabase/drafts/20260721_project_creation_atomic_rpc_forward.sql` → `supabase/drafts/20260728_project_creation_atomic_post_run.sql` → `supabase/drafts/20260721_project_creation_atomic_rpc_rollback.sql` | Full authorized create is all-or-nothing; duplicate code and cross-project/invalid assignee fail without partial rows; browser RPC rejected. When disabled, basic project + manager membership persist once, phases/tasks are omitted, and the UI reports setup is deferred. | Phase foundation and comments/activity PASS; RPC privilege/atomicity validation PASS. | Partial persistence, browser execution, missing membership/activity, duplicate-code defect, or result cannot be confirmed. | `READY_FOR_OPERATOR` |
| `PRODUCTION_ORDER_MUTATIONS_ENABLED` | Create one Production Order from the canonical artisan keycap workflow; Production Orders workspace. | false/unset | Existing `production_orders`, `production_stages`, `production_stage_dependencies`, `production_order_members`, `phases`, `tasks`, `project_activity` | `create_production_order_atomic(jsonb)` | Request-scoped authenticated execution; RPC rechecks active actor, Admin Workspace, `PROJECT_MANAGE`, `TASK_MANAGE`, project access, and required active project roles; PUBLIC/anon execution revoked. | Existing migration `20260722110928` → draft hardening `supabase/drafts/20260903_production_order_create_hardening/forward.sql` → package `validation.sql` → package `rollback.sql` | Valid canonical create is all-or-nothing; forbidden state/actor/material fields, non-canonical workflow, inactive/wrong roles, duplicate code, and partial writes fail; inventory remains unchanged. | Promote/apply reviewed hardening through protected delivery, validation PASS, rollback-only non-production fixture PASS, and separate runtime activation approval. | Partial persistence, forged state/actor/workflow, role bypass, inventory change, duplicate submission, or result cannot be confirmed. | `LIVE_APPROVAL_REQUIRED` (`HARDENING_DRAFT / RUNTIME_DISABLED`) |
| `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` | Create one normalized child task and related history atomically; Project Detail task dialog. | false/unset | Existing `tasks`, `task_comments`, `project_activity`, `task_notifications`, `project_members`, `phases` | `create_project_task_atomic(...)` | Production PASS: `SECURITY INVOKER`; `public, pg_temp`; PUBLIC/anon/authenticated EXECUTE revoked; service-role only. Server membership/phase/assignee authorization remains fixture-gated. | `supabase/validation/20260815165046_task_assignment_atomic_create_pre_run.sql` → migration `20260815165046` applied exactly once by GitHub Integration → `supabase/validation/20260815165046_task_assignment_atomic_create_validation.sql` PASS → `supabase/rollbacks/20260815165046_task_assignment_atomic_create_rollback.sql` | Pending non-production fixtures: exactly one task/activity; optional comment/notification at most one; inactive member, cross-project phase/parent and cancelled project rejected; failed RPC leaves no partial row. Disabled UI says “Chức năng thêm công việc đang chờ kích hoạt.” | Production migration history, signature, privilege, search-path and zero-integrity-count checks PASS. Non-production authorization/atomicity fixtures and separate activation approval remain required. | Partial write, cross-project acceptance, inactive assignee accepted, browser execute, duplicate submission, or any attempt to substitute production data for fixtures. | `LIVE_OPERATOR_VERIFICATION_REQUIRED` (`PRODUCTION_MIGRATION_PASS / RUNTIME_FLAG_DISABLED`) |
| `PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED` | Atomically add, change role, or revoke project membership with immutable audit; Project Detail membership section. | false/unset | `project_members` one-ACTIVE-role invariant; `project_membership_audit` | `mutate_project_membership(...)` | `SECURITY INVOKER`; PUBLIC/anon/authenticated EXECUTE revoked; service-role only; browser membership writes revoked; actor and Owner/Manager/Admin authority rechecked in transaction. | `supabase/validation/20260805_project_membership_baseline_readonly.sql` → `supabase/migrations/20260812090000_project_membership_atomic_mutations.sql` → `supabase/validation/20260812090000_project_membership_atomic_mutations_validation.sql` → `supabase/rollbacks/20260812090000_project_membership_atomic_mutations_rollback.sql` | Add/change/revoke is all-or-nothing; duplicate role, last owner, cancelled project, inactive Employee, cross-project ID and active-task revoke fail; every success has reason, before/after and correlation; disabled UI remains read-only. | Baseline duplicate report is zero; task assignment columns are verified; privilege, immutability, owner, active-task and rollback fixtures PASS. | Partial role change, browser write/execute, missing audit, final owner removed, active assignment orphaned, duplicate ACTIVE role, or lost audit export during rollback. | `READY_FOR_OPERATOR` |
| `TASK_COMMENTS_ACTIVITY_ENABLED` | Bounded immutable project/task comments and activity timeline; Project Detail timeline. | false/unset | `task_comments`, `project_activity`, immutability trigger/function | `reject_project_history_mutation()` | Authenticated project-scoped SELECT through RLS; browser INSERT/UPDATE/DELETE revoked; server-derived actor; immutable UPDATE/DELETE trigger. | `supabase/drafts/20260728_task_comments_activity_pre_run.sql` → `supabase/drafts/20260728_task_comments_activity_forward.sql` → `supabase/drafts/20260728_task_comments_activity_post_run.sql` → `supabase/drafts/20260728_task_comments_activity_rollback.sql` | Bounded read and cursor; add project/task comment; cross-project/client actor rejected; update/delete rejected; disabled timeline says “Bình luận và lịch sử hoạt động đang chờ kích hoạt.” | Phase foundation tables PASS; pre/post RLS, grants, trigger and immutability fixtures PASS. | Cross-project read/write, client actor accepted, history mutation, unbounded load, or raw database error. | `READY_FOR_OPERATOR` |
| `ATTENDANCE_RECOVERY_ENABLED` | Permit authorized administrators to repair Attendance records without changing normal staff check-in/out; Admin Attendance adjustment actions. | false/unset | `attendance`, `attendance_logs` | `has_workspace_access(text)`, `has_permission(text)` used by policies; no new browser-authority RPC | RLS enabled; Staff own-row policies; Admin Workspace + `ATTENDANCE_VIEW` read; Admin Workspace + `ATTENDANCE_MANAGE` mutation; grants remain RLS constrained. | `supabase/drafts/20260728_attendance_recovery_pre_run.sql` → `supabase/migrations/20260715073600_attendance_recovery_rls.sql` → `supabase/validation/20260715073600_attendance_recovery_rls_validation.sql` → `supabase/rollbacks/20260715073600_attendance_recovery_rls_rollback.sql` | Normal staff check-in/out/history remain available; admin recovery disabled copy is controlled; own/cross-employee and view-only/manage fixtures; create/update/delete repair; no membership dependency. | Facility verification PASS; verify migration history; run and retain the read-only pre-run; retain post-run validation; authenticated own-row/admin authorization and smoke tests PASS. Keep the flag false/unset until all evidence passes. | Staff own-row regression, unauthorized admin mutation, cross-employee access, recovery-only failure, or raw database error. | `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED` |

## Package completeness audit

| Gate | Pre | Forward | Post | Rollback | Auth/RLS notes | Regression | Flag wiring | Disabled UI | Smoke checklist |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Facility | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Phase foundation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Phase status | PASS (created) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Project atomic create | PASS (created) | PASS (grant hardened) | PASS (created) | PASS | PASS | PASS | PASS | PASS | PASS |
| Production Order create | Existing foundation | DRAFT | DRAFT | DRAFT | DRAFT | PASS | PASS | PASS | DRAFT |
| Task atomic create | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Comments/activity | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Attendance recovery | PASS (created) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

The operator smoke-test owner is `docs/production-runtime-gate-operator-runbook.md`. Forward SQL remains a reviewed package, not authorization to execute it.

## Read-only evidence procedures

Before any Attendance fixture or smoke mutation, use the production runtime
runbook's section 0. The authoritative alias is
`https://erp.luminalfactory.com`; the Vercel deployment URL is supporting
metadata only. `GET https://erp.luminalfactory.com/api/system/version` proves
the immutable Vercel commit identity without authentication, database access, or
environment disclosure. In the same authenticated Admin browser session,
`GET https://erp.luminalfactory.com/api/admin/runtime/attendance-recovery`
proves the normalized server-owned recovery state for an Admin with
`ADMIN_WORKSPACE` and `ATTENDANCE_VIEW`. Both routes are dynamic, no-store, and
read-only. On 2026-08-01 (+07:00), the version response verified production
commit `e2090766cd6d9193f43ed2006657859b9251647e` and the runtime response
verified `status=disabled` with safe correlation ID
`bc763507-2dbb-4598-b89f-5f7f8a951429`. The next boundary is
`READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`; neither route activates a gate.

## Attendance multi-check and Admin mutation gates (2026-08-04)

`ATTENDANCE_MULTI_CHECK_ENABLED` and `ATTENDANCE_MANUAL_MUTATIONS_ENABLED`
remain false/unset. The first enables the audited Staff continuation RPC; the
second enables the separately authorized Admin create/update/cancellation RPC.
Neither gate is derived from browser state or `ATTENDANCE_RECOVERY_ENABLED`.
Activation requires the draft preflight, active-row uniqueness check, operation
audit RLS review, RPC privilege review, validation output, and authenticated
smoke evidence. Package: `supabase/drafts/20260804_attendance_multi_check_admin_mutations_*`.
Until then, Staff keeps the existing single-completion behavior and Admin
Attendance remains read-only; no production rows are changed by this slice.
