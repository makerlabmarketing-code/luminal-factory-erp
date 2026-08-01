# Employee Detail tab audit

Status: **APPLICATION_COMPLETE** for the seven-tab application, **BLOCKED_BY_BUSINESS_DECISION** for the Employee Profile schema extension, and **READY_FOR_OPERATOR** for the prepared audit/operator package. Repository validation is **PASS**. Existing sources are wired without moving fields into Overview. The proposed additive schema is a draft only and has not been executed or promoted.

The completed application boundary is preserved at commit `298fabb`. The seven-tab field ownership contract below remains authoritative and must not be reopened without new defect evidence.

| Tab | Authoritative current sources | Implemented now | Missing / gated |
|---|---|---|---|
| Overview | `employees.full_name`, `email`, `phone`, `created_at` | Permission-aware read/edit for the three mutable fields; created date read-only; valid null is **Chưa cập nhật** | `birth_date`, `gender`, `address`, `avatar_url`, `personal_notes`: `SCHEMA_EXTENSION_REQUIRED` |
| Job Information | `employees.title`, `branch_code`, `status`, `hourly_rate`; facility directory | Independent dirty PATCH for title/facility/status; rate remains visible here and is edited in Personal Finance; facility failure has local Retry | `employment_type`, `employment_start_date`, `manager_employee_id`: `SCHEMA_EXTENSION_REQUIRED`. Department has no distinct source beyond current facility assignment. |
| Account & Permissions | `employees.auth_user_id`, `role`; Supabase Auth; `employee_workspace_access`; `employee_permissions` | Connection, both workspaces, assigned role, grouped Vietnamese effective permissions, capability-gated invite/reset controls reuse the authoritative account action routes; link to the authoritative permission editor; local Retry | Account mutations remain owned by the existing server actions and are not reimplemented in this tab. |
| Projects & Tasks | `project_members` + `projects`; `tasks.assignee_employee_id` | Membership/project role and active task title/status/deadline; separate optional failure and Retry | Stored progress percentage is not evidenced; status is shown without inventing progress. |
| Schedule & Attendance | `attendance`, legacy `attendance_logs` through `loadAttendanceData` | Current-month history, shift label, status, worked hours; local Retry | No approved employee-to-default-schedule source. Recovery remains operator-gated. |
| Personal Finance | `employees.bank_name`, `bank_account_number`, `hourly_rate` | Banking and hourly-rate dirty PATCH require both `EMPLOYEE_MANAGE` and `FINANCE_VIEW`; hourly rate accepts zero through the existing Employee Detail route with numeric, range, and two-decimal validation | Payroll/reimbursement summaries remain runtime-gated and are not simulated. |
| Change History | Proposed `employee_audit_events` | Controlled unavailable state | Actual field/old/new/actor/time/reason history is `SCHEMA_EXTENSION_REQUIRED`. Draft trigger excludes banking values from audit capture. |

Every optional query is isolated from the core employee row. A successful empty query renders **Chưa cập nhật**; query failure renders a local warning and Retry. Admin editing continues through the single existing Employee Detail PATCH implementation, and each editable tab sends only its owned dirty fields while preserving the active client tab after refresh.

## Package disposition

Identifier: `20260729_employee_profile_extension`.

- Pre-run: `supabase/drafts/20260729_employee_profile_extension_pre_run.sql`
- Forward draft: `supabase/drafts/20260729_employee_profile_extension_forward.sql`
- Post-run: `supabase/drafts/20260729_employee_profile_extension_post_run.sql`
- Rollback: `supabase/drafts/20260729_employee_profile_extension_rollback.sql`
- Validation: `supabase/validation/20260729_employee_profile_extension_validation.sql`

The forward SQL is deliberately outside `supabase/migrations/`. Operator/business review must approve column semantics, sensitive-field access, RLS, audit retention, and rollout before it can become a tracked migration. Do not execute any artifact from this package in the current slice.

The package is complete for operator review, including its pre-run, forward, post-run, rollback, RLS/audit design, and validation boundaries. That package completeness does not make the proposed schema eligible for execution: the schema extension remains **BLOCKED_BY_BUSINESS_DECISION**, production migration is **NOT_EXECUTED**, and the forward draft must remain outside `supabase/migrations/`.

## Business decisions required

The business and security owners must approve all eight decisions before the schema work can advance from `BLOCKED_BY_BUSINESS_DECISION`:

1. Final field semantics and nullability.
2. Admin read and edit permissions for each field.
3. Staff own-profile read and edit permissions for each field.
4. Sensitive-field visibility.
5. The audit field allowlist.
6. The audit retention period.
7. Whether old and new sensitive values may be stored in audit events.
8. Whether the audit table permits hard deletion or uses archive-only retention.

Until all eight decisions are approved, the operator may review the artifacts but must not execute SQL, promote the draft into `supabase/migrations/`, broaden RLS, activate a runtime flag, deploy, or merge on the strength of this package.
