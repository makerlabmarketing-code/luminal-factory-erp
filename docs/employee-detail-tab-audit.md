# Employee Detail tab audit

Status: **APPLICATION_COMPLETE / SCHEMA_EXTENSION_REQUIRED / READY_FOR_OPERATOR**. Existing sources are wired without moving fields into Overview. The proposed additive schema is a draft only and has not been executed.

| Tab | Authoritative current sources | Implemented now | Missing / gated |
|---|---|---|---|
| Overview | `employees.full_name`, `email`, `phone`, `created_at` | Permission-aware read/edit for the three mutable fields; created date read-only; valid null is **Chưa cập nhật** | `birth_date`, `gender`, `address`, `avatar_url`, `personal_notes`: `SCHEMA_EXTENSION_REQUIRED` |
| Job Information | `employees.title`, `branch_code`, `status`, `hourly_rate`; facility directory | Independent dirty PATCH for title/facility/status; rate is read-only/capability-protected; facility failure has local Retry | `employment_type`, `employment_start_date`, `manager_employee_id`: `SCHEMA_EXTENSION_REQUIRED`. Department has no distinct source beyond current facility assignment. |
| Account & Permissions | `employees.auth_user_id`, `role`; Supabase Auth; `employee_workspace_access`; `employee_permissions` | Connection, both workspaces, assigned role, grouped Vietnamese effective permissions, capability-gated invite/reset controls reuse the authoritative account action routes; link to the authoritative permission editor; local Retry | Account mutations remain owned by the existing server actions and are not reimplemented in this tab. |
| Projects & Tasks | `project_members` + `projects`; `tasks.assignee_employee_id` | Membership/project role and active task title/status/deadline; separate optional failure and Retry | Stored progress percentage is not evidenced; status is shown without inventing progress. |
| Schedule & Attendance | `attendance`, legacy `attendance_logs` through `loadAttendanceData` | Current-month history, shift label, status, worked hours; local Retry | No approved employee-to-default-schedule source. Recovery remains operator-gated. |
| Personal Finance | `employees.bank_name`, `bank_account_number`, `hourly_rate` | Banking independent dirty PATCH requires both `EMPLOYEE_MANAGE` and `FINANCE_VIEW`; rate is `FINANCE_VIEW`-protected | Payroll/reimbursement summaries remain runtime-gated and are not simulated. |
| Change History | Proposed `employee_audit_events` | Controlled unavailable state | Actual field/old/new/actor/time/reason history is `SCHEMA_EXTENSION_REQUIRED`. Draft trigger excludes banking values from audit capture. |

Every optional query is isolated from the core employee row. A successful empty query renders **Chưa cập nhật**; query failure renders a local warning and Retry. Admin editing continues through the single existing Employee Detail PATCH implementation, and each editable tab sends only its owned dirty fields while preserving the active client tab after refresh.

## READY_FOR_OPERATOR package

Identifier: `20260729_employee_profile_extension`.

- Pre-run: `supabase/drafts/20260729_employee_profile_extension_pre_run.sql`
- Forward draft: `supabase/drafts/20260729_employee_profile_extension_forward.sql`
- Post-run: `supabase/drafts/20260729_employee_profile_extension_post_run.sql`
- Rollback: `supabase/drafts/20260729_employee_profile_extension_rollback.sql`
- Validation: `supabase/validation/20260729_employee_profile_extension_validation.sql`

The forward SQL is deliberately outside `supabase/migrations/`. Operator/business review must approve column semantics, sensitive-field access, RLS, audit retention, and rollout before it can become a tracked migration. Do not execute any artifact from this package in the current slice.
