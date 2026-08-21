# Phase Template Production Schema Preflight Result

**Executed:** 2026-08-20; repeated 2026-08-21 before migration promotion
**Project:** Luminal Factory (`kwfmfmpgpbfewpiizesv`)
**Status:** `PASS_WITH_EXISTING_SECURITY_DEBT_RECORDED`
**Mutation count:** 0

## Execution boundary

The approved preflight ran against production through raw SQL, not the migration
API. The batch began with `BEGIN TRANSACTION READ ONLY` and ended with
`ROLLBACK`. Follow-up evidence queries were standalone `SELECT` statements.
No DDL, DML, permission change, migration-history entry, runtime flag,
environment value, seed, or business row was created or changed.

Only catalog metadata, function definitions/privileges, aggregate counts, and
constraint/security summaries were retained. No business-row content was read
or recorded.

## Compatibility result

| Check | Result |
|---|---|
| Required source relations | `projects`, `phases`, `tasks`, `employees`, `project_members`, and `permissions` present |
| Authorization helpers | `current_employee_id()`, `has_workspace_access(text)`, and `has_permission(text)` present |
| Phase Template object collisions | 0 across all six proposed relation names |
| Existing projects | 12 |
| Existing phases | 8 |
| Existing tasks | 0 |
| Duplicate `(project_id, order_index)` groups | 0 |
| Active project-member roles | 10 |
| Unsupported active role rows | 0 |
| Existing permissions | `PROJECT_VIEW` and `PROJECT_MANAGE` present |
| New permission collision | `PHASE_TEMPLATE_MANAGE` absent as expected |
| Phase Template migration-history rows | 0 |

The approved role placeholders exactly match the production
`project_members_role_code_check`: `PROJECT_OWNER`, `PROJECT_MANAGER`,
`CREATIVE_LEAD`, and `CONTRIBUTOR`.

## Source-schema decisions

- `projects.id`, `phases.id`, `tasks.id`, and `employees.id` are `bigint`.
- `projects.project_deadline` is `date`; no project-type column exists. Release
  one therefore keeps template classification on the template aggregate and
  uses only `GENERAL` without altering existing projects.
- Existing `phases.order_index` is zero-based in the live atomic project-create
  function. Approved template order remains one-based for business validation;
  apply must translate template order `n` to project phase `order_index = n - 1`.
- The normalized task columns required for cloning exist, while the live task
  count is zero. No backfill or task conversion is needed.
- Existing project/phase/task deletion behavior is not reused for template
  retention. Template versions, provenance, and audit remain immutable and use
  restrictive references.

## Security review

All inspected source tables have RLS enabled. `phases` and `tasks` currently
have no RLS policies, while legacy `anon`/`authenticated` table privileges are
still present. Supabase Security Advisor reports those two tables at INFO level
as `rls_enabled_no_policy`. This is existing source-schema debt; it was not
created by this preflight.

The new Phase Template package must not inherit those grants. New tables receive
RLS immediately, no `anon` access, no browser insert/update/delete privileges,
and only explicitly authorized read policies.

The live `create_project_atomic(jsonb)` function is `SECURITY DEFINER`, owned by
`postgres`, and executable by `authenticated`. Its body derives the actor from
`auth.uid()`, resolves an active employee, checks `ADMIN_WORKSPACE` plus
`PROJECT_MANAGE`, and rejects client-supplied actor fields. Supabase Security
Advisor still reports the generic authenticated-`SECURITY DEFINER` warning.

For release one, template application should extend this existing atomic
project-create boundary instead of introducing a second browser-executable
apply function. It must recheck the current published version, template
visibility, project-create permission, offsets, role placeholders, and complete
clone inside the same transaction. The warning is accepted only with retained
authorized/denied and zero-partial-persistence evidence. Template-management
RPCs require the same actor derivation plus `PHASE_TEMPLATE_MANAGE`; direct
table writes remain prohibited.

Other Security Advisor findings belong to existing Attendance, Payroll,
Reimbursement, Production, Auth, and unrelated tables/functions. They were not
changed or promoted into this Phase Template slice.

## Gate result

The schema preflight is `PASS_WITH_EXISTING_SECURITY_DEBT_RECORDED`. No collision,
count drift, unsupported role, missing source relation, or missing authorization
helper blocks the bounded repository package.

The final post-check repeated the production aggregates at 12 projects, 8
phases, 0 tasks, and 10 active project-member roles, matching the preflight
values. Migration history contained 0 Phase Template rows.

The 2026-08-21 repeat also confirmed that the Phase Template relations, source
columns, and management RPC were absent; the live
`create_project_atomic(jsonb)` checksum remained
`f893db4f9c021120ea697badda853cb9`; and source counts remained 12 projects, 8
phases, and 0 tasks. The business owner then approved direct production
delivery. PR #177 subsequently merged as `0f3fe87`; Supabase GitHub Integration
applied the migration exactly once, and read-only post-validation preserved the
same 12/8/0 source counts. See
[phase-template-production-delivery-result.md](phase-template-production-delivery-result.md).
`PHASE_TEMPLATES_ENABLED` remains false/unset.
