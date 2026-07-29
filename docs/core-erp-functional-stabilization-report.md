# Core ERP Functional Stabilization Report

**Audit date:** 2026-07-29
**Decision:** `BLOCKED_FOR_SAAS_UI_RESKIN`
**Scope:** application behavior and repository-owned operator artifacts only. No GitHub comments were reviewed, no SQL/RPC was executed, no runtime flag was enabled, and nothing was deployed or merged.

## Journey status matrix

| Journey | Status | Working behavior | Remaining blocker | Required operator action | Ready for UI re-skin |
|---|---|---|---|---|---|
| 1. Authentication and role routing | FUNCTIONAL | Auth session lookup, employee connection, active-state check, Admin/Staff workspace separation, login, logout, callback, password reset, and the legacy `/staff/portal` redirect have regression coverage. | Production account/workspace fixtures were not exercised from this environment. | Smoke-test one Admin-only, Staff-only, dual-workspace, disconnected, and inactive account. | Yes |
| 2. Employee list and employee detail | FUNCTIONAL / PRODUCTION_SMOKE_PASS | `public.employees` is authoritative for Admin and Staff; shared persistence/readback, partial Admin updates, approved Staff own-profile updates, optional-warning separation, and workspace notification isolation passed authenticated production smoke. | Facility/Auth directory reconciliation remains a separate operator gate; Employee Profile persistence has no remaining incident blocker. | Preserve the closed persistence contract; do not reopen it without new evidence. | Yes |
| 3. Account connection, Workspace Permissions, and individual permissions | LIVE_OPERATOR_VERIFICATION_REQUIRED | Account connection and permission mutations use server-derived authorization; workspace and individual permission semantics remain separate and fail closed. | Permission catalog/grant package and production fixtures have not been operator-validated in this run. | Run the package in register order, validate known/unknown permission codes and grant/revoke fixtures, then retain runtime mutation gates disabled until PASS. | No |
| 4. Facility directory and employee-facility resolution | LIVE_OPERATOR_VERIFICATION_REQUIRED | Directory reads support reviewed and legacy projections, preserve missing/unresolved values, and resolve employees by stable code/name compatibility without exposing raw numeric mappings. | Production compatibility audit and active-facility behavior are not attached as PASS. | Run both facility validation artifacts; enable `FACILITY_ACTIVE_STATE_ENABLED=true` only after PASS. | No |
| 5. Staff Portal and attendance | LIVE_OPERATOR_VERIFICATION_REQUIRED | Staff Portal routes render separate attendance/task/expense/profile tabs; normal own-row check-in/check-out is independent from both Project Membership and the recovery flag; Admin attendance stays useful and read-only while recovery is disabled. The repository package and regression audit is complete. | Live own-row/RLS and authorized/denied recovery smoke evidence remains; recovery mutation is disabled. | Run the registered Gate 2 pre/post and authorization/RLS smoke sequence; enable `ATTENDANCE_RECOVERY_ENABLED=true` only after operator PASS. | No |
| 6. Project list, creation, cancellation, and detail | FUNCTIONAL | List refresh is request-local; basic project creation persists once and routes by confirmed ID; cancellation and detail preserve server authorization; core detail renders before optional sections and exposes targeted retries. | Atomic phase/task creation is intentionally unavailable until its RPC contract is validated. | Keep `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED=false`; operator validation is required only for full workflow creation. | Yes |
| 7. Project Membership | FUNCTIONAL | Add/change/revoke membership uses stable employee IDs and server capabilities; inactive membership is excluded from assignment; Attendance and facility access do not derive from membership. | Production membership fixtures were not exercised in this environment. | Smoke-test owner/manager/contributor/read-only/cancelled-project fixtures during the operator run. | Yes |
| 8. Phase Workflow | RUNTIME_FLAG_DISABLED | Read-only phase compatibility, transition validation, dependency rules, cancelled-project locks, and safe capability responses are present. | Durable phase status/audit package has not completed operator pre-run/post-run validation; flags remain false. | Run the reviewed Phase Workflow package and smoke tests, then enable foundation and status flags in checklist order. | No |
| 9. Child Task CRUD | RUNTIME_FLAG_DISABLED | Normalized task read/edit/status/cancellation contracts, active-member assignment, validation, targeted refresh, and double-submit protection are present. No persistence is faked when atomic create is unavailable. | Atomic create RPC has not been operator-delivered and validated. | Run pre-run, deliver RPC through protected migration workflow, run post-run and atomicity/authorization smoke tests, then enable `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=true`. | No |
| 10. Task comments and project activity | RUNTIME_FLAG_DISABLED | Section-local bounded loading, Retry, text validation, server-derived actor, and disabled explanatory UI are present. | Immutable comment/activity schema and authorization package is not live. | Run pre-run/forward/post-run and cross-project/immutability smoke tests, then enable `TASK_COMMENTS_ACTIVITY_ENABLED=true`. | No |
| 11. Ledger and reimbursement | LIVE_OPERATOR_VERIFICATION_REQUIRED | Legacy ledger loads, filters, creates and edits; failed loads now expose local Retry; create/edit buttons block duplicate submission and show pending state; errors remain sanitized to operators. | New reimbursement/storage workflow is blocked on category, beneficiary, legacy mapping, and private receipt policy decisions. Direct live ledger behavior was not exercised here. | Smoke-test existing ledger CRUD; approve finance business rules before running the prepared ledger/storage package. | No |
| 12. Payroll settlement | BLOCKED_BY_BUSINESS_DECISION | Attendance-derived hours and salary calculations remain covered; the settlement button is honestly disabled and does not fake persistence. | Official shift boundaries, settlement revision/immutability, first settlement month, and own-salary access are not approved; no runnable SQL package exists. | Approve the payroll business contract, then prepare/review pre-run, forward, post-run, rollback, RLS, and smoke-test artifacts. | No |
| 13. Dashboard | FUNCTIONAL | Server-owned paid-ledger DTO fails visibly instead of rendering fake zeroes; Retry now uses an in-app server refresh with pending state rather than a full-page navigation. | Live paid-ledger RLS/data fixture was not exercised here. | Smoke-test an authorized Admin with empty, populated, and denied/error ledger fixtures. | Yes |

## Application bugs fixed

0. **Employee Profile persistence:** `EMPLOYEE_PROFILE_PERSISTENCE_PASS` closes the incident after production Admin and Staff persistence/readback, unchanged-field, own-row, and workspace-notification isolation verification. No SQL, RLS broadening, or runtime flag change was needed.

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

## Runtime gate readiness reconciliation (2026-07-28)

All seven remaining runtime packages are repository-complete for operator handoff. `READY_FOR_OPERATOR` and `LIVE_OPERATOR_VERIFICATION_REQUIRED` are package states, not proof of live activation. No flag was enabled.

### Focused functional regression classification

| Area | Classification | Evidence boundary |
|---|---|---|
| Authentication | FUNCTIONAL | Session, active employee, callback/login/logout/reset regression coverage passes. |
| Role routing | FUNCTIONAL | Admin/Staff/dual workspace and legacy portal route contracts are covered; live fixtures remain operator smoke work. |
| Employee list/detail | FUNCTIONAL | Core rows and partial enrichment/error states remain covered. |
| Account/workspace | LIVE_OPERATOR_VERIFICATION_REQUIRED | Server authorization is functional; live permission catalog and account fixtures remain. |
| Facility | RUNTIME_FLAG_DISABLED | Directory is readable; mutations are server-gated and disabled UI uses the approved waiting copy. |
| Attendance | FUNCTIONAL_READ_ONLY | Normal Staff Attendance remains functional; Admin recovery alone is disabled pending Facility/RLS verification. |
| Project creation | FUNCTIONAL | Basic project and manager membership persist without faking phase/task persistence; full atomic workflow is flag-disabled. |
| Project detail | FUNCTIONAL_READ_ONLY | Core detail, memberships, phase/task display and targeted retry remain; gated mutations stay controlled. |
| Membership | FUNCTIONAL | Stable employee IDs, ACTIVE membership and server permissions remain covered. |
| Phase display | FUNCTIONAL_READ_ONLY | Phase display remains available while persistence/status flags are false. |
| Task display | FUNCTIONAL_READ_ONLY | Existing tasks remain readable/editable within existing capabilities; atomic child-task create is disabled. |
| Comments/activity display | RUNTIME_FLAG_DISABLED | Exact waiting copy replaces mutation/timeline capability without a fake empty state. |
| Ledger | LIVE_OPERATOR_VERIFICATION_REQUIRED | Existing behavior is covered; live CRUD/RLS fixture and separate finance decisions remain. |
| Payroll | BLOCKED_BY_BUSINESS_DECISION | Calculations remain functional; official settlement contract is not approved. |
| Dashboard | FUNCTIONAL | Paid-ledger DTO/error/retry behavior remains covered; live data fixture remains an operator smoke check. |

### SaaS UI re-skin decision

`PARTIALLY_SAFE`. Authentication, employee, project-list/core-detail, membership, and dashboard surfaces classified `FUNCTIONAL` can be scoped for later design work. Broad re-skin execution remains deferred because operational gate activation, Account/Workspace live verification, Ledger live verification, and Payroll business decisions are incomplete. This readiness slice does not reopen or redesign stabilized UI.

## Final application stabilization checkpoint — 2026-07-28

This section supersedes earlier classifications in this report where later Payroll and Ledger/Reimbursement approvals completed their repository packages.

| Journey | Current application status | Remaining boundary |
|---|---|---|
| Authentication and role routing | FUNCTIONAL | Operator smoke fixtures only. |
| Employee list/detail | FUNCTIONAL / PRODUCTION_SMOKE_PASS | Employee Profile persistence is closed; Facility/Auth enrichment reconciliation remains a separate operator gate. |
| Facility directory | FUNCTIONAL_READ_ONLY | Active-state mutation remains disabled pending Facility operator PASS. |
| Account/workspace permissions | APPLICATION_COMPLETE | Catalog, linkage, grant/revoke, and denial fixtures remain operator work. |
| Attendance | FUNCTIONAL_READ_ONLY | Recovery remains disabled pending Facility and Attendance authorization/RLS PASS. |
| Project list/create/detail/cancel | FUNCTIONAL_READ_ONLY | Basic persistence works; atomic workflow creation remains disabled. |
| Project membership | FUNCTIONAL | Production role/cancelled-project fixtures remain operator verification. |
| Phase workflow | FUNCTIONAL_READ_ONLY | Foundation and status mutation gates remain disabled. |
| Child tasks | FUNCTIONAL_READ_ONLY | Existing task contracts remain; atomic create is disabled and never fakes persistence. |
| Comments/activity | SAFE_DISABLED | Vietnamese waiting/error states replace unavailable persistence; no fake empty timeline is produced. |
| Ledger/reimbursement | FUNCTIONAL_READ_ONLY / READY_FOR_OPERATOR | Legacy ledger remains available; reimbursement mutation is disabled pending package delivery and private Storage/RLS verification. |
| Payroll | SAFE_DISABLED / READY_FOR_OPERATOR | Disabled API returns the Vietnamese activation message; no settlement is faked. Operator package, first-month configuration, authorization, and smoke PASS remain. |
| Dashboard | FUNCTIONAL | Live paid-ledger empty/populated/denied/error fixtures remain operator verification. |

### Regressions fixed in the final pass

1. Payroll month changes and Retry requests now use a request sequence so a superseded response cannot overwrite current Admin or Staff state.
2. Payroll settlement and adjustment retain the synchronous duplicate-submit lock and now also disable all mutation buttons with action-specific Vietnamese pending text.
3. Payroll Retry buttons now disable and show **Đang thử lại...** while the current request is active.

### Completion and UI decision

All safe Item 15 application work is complete. Employee Profile persistence is closed with `EMPLOYEE_PROFILE_PERSISTENCE_PASS`. Live verification and activation for the remaining gates are operator work, not unfinished application implementation. Scoped SaaS UI work is `PARTIALLY_SAFE`, but no gated mutation surface may be redesigned and the broad re-skin remains blocked. The exact next roadmap item is **Item 16, Gate 2 — Attendance recovery operator evidence**; its runtime flag remains disabled.
