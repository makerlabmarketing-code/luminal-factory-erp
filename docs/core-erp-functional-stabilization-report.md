# Core ERP Functional Stabilization Report

**Audit date:** 2026-07-28  
**Decision:** `BLOCKED_FOR_SAAS_UI_RESKIN`  
**Scope:** application behavior and repository-owned operator artifacts only. No GitHub comments were reviewed, no SQL/RPC was executed, no runtime flag was enabled, and nothing was deployed or merged.

## Journey status matrix

| Journey | Status | Working behavior | Remaining blocker | Required operator action | Ready for UI re-skin |
|---|---|---|---|---|---|
| 1. Authentication and role routing | FUNCTIONAL | Auth session lookup, employee connection, active-state check, Admin/Staff workspace separation, login, logout, callback, password reset, and the legacy `/staff/portal` redirect have regression coverage. | Production account/workspace fixtures were not exercised from this environment. | Smoke-test one Admin-only, Staff-only, dual-workspace, disconnected, and inactive account. | Yes |
| 2. Employee list and employee detail | FUNCTIONAL | Core rows survive optional facility/Auth/workspace/permission/project enrichment failures; list and detail distinguish invalid ID, not found, forbidden, retryable failure, and partial enrichment warnings. | Live facility/Auth reconciliation remains operator verification. | Run the facility/employee compatibility audit and account-link fixture checks. | Yes |
| 3. Account connection, Workspace Permissions, and individual permissions | LIVE_OPERATOR_VERIFICATION_REQUIRED | Account connection and permission mutations use server-derived authorization; workspace and individual permission semantics remain separate and fail closed. | Permission catalog/grant package and production fixtures have not been operator-validated in this run. | Run the package in register order, validate known/unknown permission codes and grant/revoke fixtures, then retain runtime mutation gates disabled until PASS. | No |
| 4. Facility directory and employee-facility resolution | LIVE_OPERATOR_VERIFICATION_REQUIRED | Directory reads support reviewed and legacy projections, preserve missing/unresolved values, and resolve employees by stable code/name compatibility without exposing raw numeric mappings. | Production compatibility audit and active-facility behavior are not attached as PASS. | Run both facility validation artifacts; enable `FACILITY_ACTIVE_STATE_ENABLED=true` only after PASS. | No |
| 5. Staff Portal and attendance | LIVE_OPERATOR_VERIFICATION_REQUIRED | Staff Portal routes render separate attendance/task/expense/profile tabs; own attendance is independent from Project Membership; Admin attendance stays useful and read-only when recovery is disabled, with loading, error, and Retry states. | Live own-row/RLS and facility smoke tests remain; recovery mutation is disabled. | Validate facility first, then Attendance recovery RLS and own-row/admin authorization fixtures; only afterward enable `ATTENDANCE_RECOVERY_ENABLED=true`. | No |
| 6. Project list, creation, cancellation, and detail | FUNCTIONAL | List refresh is request-local; basic project creation persists once and routes by confirmed ID; cancellation and detail preserve server authorization; core detail renders before optional sections and exposes targeted retries. | Atomic phase/task creation is intentionally unavailable until its RPC contract is validated. | Keep `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED=false`; operator validation is required only for full workflow creation. | Yes |
| 7. Project Membership | FUNCTIONAL | Add/change/revoke membership uses stable employee IDs and server capabilities; inactive membership is excluded from assignment; Attendance and facility access do not derive from membership. | Production membership fixtures were not exercised in this environment. | Smoke-test owner/manager/contributor/read-only/cancelled-project fixtures during the operator run. | Yes |
| 8. Phase Workflow | RUNTIME_FLAG_DISABLED | Read-only phase compatibility, transition validation, dependency rules, cancelled-project locks, and safe capability responses are present. | Durable phase status/audit package has not completed operator pre-run/post-run validation; flags remain false. | Run the reviewed Phase Workflow package and smoke tests, then enable foundation and status flags in checklist order. | No |
| 9. Child Task CRUD | RUNTIME_FLAG_DISABLED | Normalized task read/edit/status/cancellation contracts, active-member assignment, validation, targeted refresh, and double-submit protection are present. No persistence is faked when atomic create is unavailable. | Atomic create RPC has not been operator-delivered and validated. | Run pre-run, deliver RPC through protected migration workflow, run post-run and atomicity/authorization smoke tests, then enable `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=true`. | No |
| 10. Task comments and project activity | RUNTIME_FLAG_DISABLED | Section-local bounded loading, Retry, text validation, server-derived actor, and disabled explanatory UI are present. | Immutable comment/activity schema and authorization package is not live. | Run pre-run/forward/post-run and cross-project/immutability smoke tests, then enable `TASK_COMMENTS_ACTIVITY_ENABLED=true`. | No |
| 11. Ledger and reimbursement | LIVE_OPERATOR_VERIFICATION_REQUIRED | Legacy ledger loads, filters, creates and edits; failed loads now expose local Retry; create/edit buttons block duplicate submission and show pending state; errors remain sanitized to operators. | New reimbursement/storage workflow is blocked on category, beneficiary, legacy mapping, and private receipt policy decisions. Direct live ledger behavior was not exercised here. | Smoke-test existing ledger CRUD; approve finance business rules before running the prepared ledger/storage package. | No |
| 12. Payroll settlement | BLOCKED_BY_BUSINESS_DECISION | Attendance-derived hours and salary calculations remain covered; the settlement button is honestly disabled and does not fake persistence. | Official shift boundaries, settlement revision/immutability, first settlement month, and own-salary access are not approved; no runnable SQL package exists. | Approve the payroll business contract, then prepare/review pre-run, forward, post-run, rollback, RLS, and smoke-test artifacts. | No |
| 13. Dashboard | FUNCTIONAL | Server-owned paid-ledger DTO fails visibly instead of rendering fake zeroes; Retry now uses an in-app server refresh with pending state rather than a full-page navigation. | Live paid-ledger RLS/data fixture was not exercised here. | Smoke-test an authorized Admin with empty, populated, and denied/error ledger fixtures. | Yes |

## Application bugs fixed

1. **Ledger duplicate submission:** create and edit mutations now return early while a prior submit is in flight, disable both modal actions, and expose Vietnamese pending copy.
2. **Ledger missing Retry:** a failed core ledger load now has a local `loadData()` Retry instead of a terminal error panel.
3. **Ledger request churn:** `loadData` is callback-stable and the month effect depends on that boundary, removing the previous exhaustive-deps defect while preserving one refresh boundary per reporting-period change.
4. **Dashboard full-page reload:** the error action now uses `router.refresh()` inside a transition and disables itself while retrying.

## Remaining runtime gates and exact activation prerequisites

| Runtime gate | Default | Activation prerequisite |
|---|---:|---|
| `FACILITY_ACTIVE_STATE_ENABLED` | false/unset | Facility compatibility audit and status/code validation PASS; Attendance assigned-facility and inactive-exclusion smoke test PASS. |
| `PHASE_WORKFLOW_FOUNDATION_ENABLED` | false/unset | Phase pre-run attached, protected migration delivery successful, post-run validation and legacy phase-read regression PASS. |
| `PHASE_STATUS_MUTATION_ENABLED` | false/unset | Foundation gate active plus status RPC authorization, transition, dependency, audit, and cancelled-project smoke tests PASS. |
| `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED` | false/unset | Transactional project-workflow RPC contract deployed and validated for atomicity and rollback behavior. |
| `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` | false/unset | Task-create pre-run/forward/post-run PASS; exactly-one task/activity behavior and cross-project rejection smoke-tested. |
| `TASK_COMMENTS_ACTIVITY_ENABLED` | false/unset | Comment/activity objects, RLS, immutable triggers, bounded reads, and actor derivation validated. |
| `ATTENDANCE_RECOVERY_ENABLED` | false/unset | Facility verification and Attendance recovery RLS/own-row/admin-permission smoke tests PASS. |

## Remaining SQL/RPC packages

- **Operator-ready or verification-required:** facility compatibility, Phase Workflow, atomic task creation, task comments/activity, Attendance recovery, and workspace permissions.
- **Blocked by business decision:** Phase Templates, ledger/reimbursement/storage, and Payroll settlement.
- **No package may be inferred as live from repository presence.** Forward, rollback, and validation files are delivery artifacts; runtime gates stay false until the package-specific post-run and smoke tests pass.

## Validation result

The repository full suite, lint, typecheck, production build, and diff check are required after the documentation commit. Existing lint/build warnings are limited to the recorded `next/image`, legacy hook-dependency, Supabase Edge Runtime, and Node 20 deprecation warnings; they do not change journey classifications.

## UI re-skin decision

`BLOCKED_FOR_SAAS_UI_RESKIN`.

Core application routes build and the audited functional journeys fail safely, but Account/Permissions, Facility, Attendance, Phase Workflow, Child Task create, Comments/Activity, Ledger live behavior, and Payroll settlement still require operator verification, disabled runtime activation, or approved business rules. Broad visual redesign would make those unresolved operational boundaries harder to validate. Resume the re-skin only after every “Ready for UI re-skin” entry above is Yes and all required validation gates pass.

## Proposed pull request

**Title:** `fix: complete core ERP functional stabilization gate`

**Description:**

> Audits the thirteen primary ERP journeys before any broad SaaS visual redesign. Stabilizes ledger retry and duplicate-submit behavior, replaces the Dashboard full-page retry with an in-app refresh, adds regression coverage, records per-journey classifications, and reconciles the roadmap/operator handoff with exact runtime and SQL/RPC prerequisites. No GitHub review comments, production SQL, runtime flag activation, deployment, or merge is included.
