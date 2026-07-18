# Migration Repair Execution Plan

Date: 2026-07-17
Linked project ref: `kwfmfmpgpbfewpiizesv`

This is a metadata repair plan only. Do not run any command in this file until each command is explicitly approved.

Guardrails:

- Do not run `supabase migration repair` before approval.
- Do not run `supabase db push`, `supabase db pull`, `supabase db reset`, or any migration.
- Do not run SQL mutation or live-data repair.
- Do not use ranges, blanket repair, or multi-version repair commands.
- Repair only one explicit version per command.

## Final Remote History Snapshot

Read-only remote `supabase_migrations.schema_migrations` snapshot:

| Version | Remote name |
| --- | --- |
| `20260712181332` | `add_employee_auth_user_id` |
| `20260714032416` | `rls_admin_office_expenses_shareholders_select` |
| `20260715073600` | `attendance_recovery_rls` |

Local migration versions:

| Version | Local | Remote | Classification | Planned action |
| --- | --- | --- | --- | --- |
| `20260704153000` | Yes | No | SUPERSEDED / BLOCKED | Exclude. Do not repair. Do not rerun. |
| `20260709110000` | Yes | No | NOT_APPLIED / BLOCKED | Exclude. Do not repair. Do not rerun without separate schema approval. |
| `20260712181332` | Yes | Yes | APPLIED remote | No action. |
| `20260713111027` | Yes | No | APPLIED | Repair metadata as applied candidate. |
| `20260714032416` | Yes | Yes | APPLIED remote | No action. |
| `20260714045636` | Yes | No | APPLIED / MANUAL REVIEW | Repair metadata as applied candidate. |
| `20260714082140` | Yes | No | APPLIED_WITH_DRIFT | Repair metadata as applied candidate if drift accepted. |
| `20260715030000` | Yes | No | APPLIED | Repair metadata as applied candidate. |
| `20260715073600` | Yes | Yes | APPLIED remote | No action. |
| `20260716035555` | Yes | No | APPLIED / MANUAL REVIEW | Repair metadata as applied candidate. |

No new remote migration version was found compared with the previous audit.

## Candidate Revalidation

| Version | Revalidation result | Evidence | Final repair status |
| --- | --- | --- | --- |
| `20260713111027` | PASS | `is_app_admin()` signature/body/search_path/security mode/grants match. `financial ledger admin select` policy is SELECT/authenticated using `is_app_admin()`. No DML required. | Candidate |
| `20260714082140` | PASS with drift | Foundation tables, constraints, indexes, triggers, helpers, RLS, policies, grants, and 17 permission catalog rows match. Access/permission data rows are valid and intentional current app state. | Candidate if drift accepted |
| `20260715030000` | PASS | `employees admin employee view select` policy is SELECT/authenticated using ADMIN_WORKSPACE + EMPLOYEE_VIEW. No DML required. | Candidate |
| `20260714045636` | PASS | `project_members` schema, constraints, indexes, RLS policies, trigger, and helper function match core migration. No DML required. | Candidate |
| `20260716035555` | PASS | `is_project_member`, `has_project_role`, `can_view_project`, grants, and `projects project access select` match. No DML required. | Candidate |

No candidate needs DML/backfill rerun. The repair action only updates Supabase migration history metadata.

## APPLIED_WITH_DRIFT Decision: `20260714082140`

Observed current data:

- `public.permissions`: 17 rows, matching the migration seed catalog.
- `public.employee_workspace_access`: 2 rows.
- `public.employee_permissions`: 17 rows.
- All `employee_workspace_access` rows are `ACTIVE`; 1 `ADMIN_WORKSPACE`, 1 `STAFF_WORKSPACE`.
- All `employee_permissions` rows are `ACTIVE` and `ALLOW`.
- Invalid FK/status/workspace/effect/duplicate checks all returned 0 issues.
- `employee_workspace_access` and `employee_permissions` rows have `created_at`/`updated_at` at `2026-07-14 10:01:29.576344+00`, after the permission catalog rows at `2026-07-14 08:46:21.018571+00`.
- Repository server code writes these tables through account/admin operations in `services/server/adminAccountManagement.ts`, `services/server/adminEmployeeActions.ts`, `services/server/adminEmployeeData.ts`, and `services/server/auth.ts`.

Decision:

- Keep classification `APPLIED_WITH_DRIFT`.
- Treat the 2 workspace rows and 17 employee permission rows as intentional application/admin state.
- Repairing `20260714082140` as applied does not claim the original migration backfilled employee access or employee permissions. It only records that the schema/helper/RLS foundation migration is already represented in live objects.

## Exclusion Guard

Hard exclusion list:

- `20260704153000`
- `20260709110000`

Review must fail if any repair command includes either version.

Forbidden command patterns:

- Any command repairing `20260704153000`.
- Any command repairing `20260709110000`.
- Any range-based or blanket repair.
- Any command with more than one version argument.
- Any command not using `--linked` against the linked project.

## CLI Syntax Verified

Local CLI help reports:

```text
supabase migration repair [flags] <version...>
--status choice    choices: applied, reverted
--linked           Repairs the migration history of the linked project.
```

Use one explicit version per command for auditability.

## Proposed Repair Commands

Dependency/version order:

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713111027
npx.cmd supabase migration repair --linked --status applied 20260714045636
npx.cmd supabase migration repair --linked --status applied 20260714082140
npx.cmd supabase migration repair --linked --status applied 20260715030000
npx.cmd supabase migration repair --linked --status applied 20260716035555
```

These commands were not run.

## Pre-repair Checklist

Before each individual repair command:

1. Confirm linked project ref is `kwfmfmpgpbfewpiizesv`.
2. Run remote history snapshot and confirm only `20260712181332`, `20260714032416`, and `20260715073600` are remote-applied.
3. Run `supabase/drafts/20260717_migration_repair_pre_post_validation.sql`.
4. Confirm target version is one of the five candidates.
5. Confirm target version is not in the exclusion list.
6. Confirm no command contains more than one version.
7. Confirm `git status --short` has no unapproved production migration changes. Draft/report file changes are expected.
8. Confirm no `supabase db push`, `db pull`, `db reset`, or migration session is running.
9. Save/capture `supabase migration list` output before the repair.

Read-only commands:

```powershell
Get-Content -Raw supabase\.temp\project-ref
npx.cmd supabase migration list
npx.cmd supabase db query --linked --file supabase/drafts/20260717_migration_repair_pre_post_validation.sql
git status --short
```

Note: `supabase status` attempted local Docker inspection in this environment and failed, so it is not used as the project-ref check. The linked ref is read from `supabase/.temp/project-ref`.

## Post-repair Validation

After each individual repair command:

1. Run `npx.cmd supabase migration list`.
2. Confirm exactly the repaired version changed from local-only to remote-applied.
3. Confirm excluded versions `20260704153000` and `20260709110000` remain not remote-applied.
4. Run `supabase/drafts/20260717_migration_repair_pre_post_validation.sql`.
5. Confirm row counts did not change for:
   - `employees`
   - `employee_workspace_access`
   - `employee_permissions`
   - `project_members`
   - `projects`
   - `phases`
   - `tasks`
   - `attendance`
   - `financial_ledger`
6. Confirm schema/policies/functions/indexes/triggers are unchanged.
7. Run application validation after the full repair set:

```powershell
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

If a script is not available, record it as unavailable instead of claiming PASS.

## Metadata Rollback Plan

If a version is mistakenly marked applied, rollback only migration-history metadata. Do not run schema rollback SQL.

CLI help supports `--status reverted`.

Rollback commands, one version at a time:

```powershell
npx.cmd supabase migration repair --linked --status reverted 20260713111027
npx.cmd supabase migration repair --linked --status reverted 20260714045636
npx.cmd supabase migration repair --linked --status reverted 20260714082140
npx.cmd supabase migration repair --linked --status reverted 20260715030000
npx.cmd supabase migration repair --linked --status reverted 20260716035555
```

Rollback preconditions:

- Only use for a version that was just repaired incorrectly.
- Confirm no production schema/data migration was run after the bad repair.
- Confirm the rollback target is not an actually-applied production migration that should remain in history.

Rollback validation:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db query --linked --file supabase/drafts/20260717_migration_repair_pre_post_validation.sql
```

Expected impact:

- Migration history metadata changes only.
- No schema, policy, function, grant, index, trigger, or row count changes.

## Superseded Migration Documentation Plan

Do not edit executable migration files in this repair step. Editing old migration files can create checksum/source-history confusion and makes the repair review harder.

Safe choice for this phase:

- Keep documentation in sidecar draft/report files.
- Do not modify `supabase/migrations/20260704153000_move_workflow_to_project_tables.sql`.
- Do not modify `supabase/migrations/20260709110000_add_colorway_stage_fields.sql`.

Recommended later documentation-only change, after repair approval:

```sql
-- DO NOT RUN WITHOUT ARCHITECT APPROVAL.
-- Classification: SUPERSEDED / BLOCKED or NOT_APPLIED / BLOCKED.
-- Audit date: 2026-07-17.
-- Replacement authority: Phase Workflow Foundation draft and later approved
-- colorway/stage workflow migration.
-- Validation report:
-- supabase/drafts/20260717_migration_history_drift_reconciliation_pre_run_audit.md
```

## Phase Workflow Authority

- `20260704153000_move_workflow_to_project_tables.sql` is not phase workflow authority.
- `20260709110000_add_colorway_stage_fields.sql` is not phase workflow authority.
- Phase Workflow Foundation draft is the planned authority, pending approval.
- Foundation rollout remains blocked until repair candidates are processed and migration list has no dangerous historical pending migration in front of it.

Expected pending migrations after successful repair:

| Version | Reason still pending |
| --- | --- |
| `20260704153000` | SUPERSEDED / BLOCKED. Must not run. |
| `20260709110000` | NOT_APPLIED / BLOCKED pending replacement/supersession decision. |

No other historical local-only repair candidate should remain pending after the five approved repairs.

## Gate Status

| Gate | Status | Evidence |
| --- | --- | --- |
| Remote history snapshot read | PASS | Remote table still has only `20260712181332`, `20260714032416`, `20260715073600`. |
| Each repair candidate revalidated | PASS | Functions, policies, constraints, indexes, triggers, grants, and row counts checked. |
| APPLIED_WITH_DRIFT explained | PASS | `20260714082140` data rows valid and tied to current app/admin state; repair is metadata only. |
| Exclusion guard present | PASS | `20260704153000` and `20260709110000` explicitly forbidden. |
| Exact CLI syntax checked | PASS | `supabase migration repair --help` read. |
| Commands explicit one-version each | PASS | Five separate commands listed. |
| Pre/post validation complete | PASS | Dedicated validation SQL created. |
| Metadata rollback plan complete | PASS | `--status reverted` commands listed. |
| No repair run | PASS | No repair command executed. |
| No live data mutation | PASS | Only read-only SELECT/catalog checks. |

## Safe Next Action

Review and approve or reject each repair command one by one. Start with:

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713111027
```

Do not proceed to the next command until post-repair validation passes for the previous command.
