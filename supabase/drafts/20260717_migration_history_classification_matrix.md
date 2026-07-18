# Migration History Classification Matrix

Date: 2026-07-17

Scope: local-only migration history drift reconciliation. No repair, push, pull, reset, SQL mutation, commit, or push was run while producing this matrix.

| Migration | Classification | Repair candidate | Must not rerun | Required action |
| --- | --- | --- | --- | --- |
| `20260704153000_move_workflow_to_project_tables.sql` | SUPERSEDED / BLOCKED | No | Yes | Keep history file, add superseded warning only after approval, replace with reconciliation/foundation path. |
| `20260709110000_add_colorway_stage_fields.sql` | NOT_APPLIED | No | Until reviewed | Decide whether superseded by Phase Workflow Foundation/colorway-stage redesign or separately approve a replacement. |
| `20260713111027_rls_admin_financial_ledger_select.sql` | APPLIED | Yes, after validation and approval | Yes | Repair as applied candidate; live helper and policy match. |
| `20260714045636_project_members_foundation.sql` | APPLIED / MANUAL REVIEW | Yes, after validation and approval | Yes | Repair as applied candidate; live core objects match. |
| `20260714082140_access_permission_foundation.sql` | APPLIED_WITH_DRIFT | Yes, after validation, approval, and acceptance of post-migration data drift | Yes | Repair as applied candidate; live core objects match; access override tables now contain rows from later manual/operational backfill. |
| `20260715030000_rls_employee_admin_view_select.sql` | APPLIED | Yes, after validation and approval | Yes | Repair as applied candidate; live employees admin SELECT policy matches. |
| `20260716035555_project_rls_pre_run_review.sql` | APPLIED / MANUAL REVIEW | Yes, after validation and approval | Yes | Repair as applied candidate; live project helpers and policy match. |

Safe repair candidate set, pending explicit approval and pre-repair validation:

```powershell
npx.cmd supabase migration repair --linked --status applied 20260713111027
npx.cmd supabase migration repair --linked --status applied 20260714045636
npx.cmd supabase migration repair --linked --status applied 20260714082140
npx.cmd supabase migration repair --linked --status applied 20260715030000
npx.cmd supabase migration repair --linked --status applied 20260716035555
```

Execution plan with exact CLI syntax and rollback commands:

- `supabase/drafts/20260717_migration_repair_execution_plan.md`

Focused pre/post validation SQL:

- `supabase/drafts/20260717_migration_repair_pre_post_validation.sql`

Do not include:

- `20260704153000`: superseded/blocked; running would apply deprecated workflow DML and broad policies.
- `20260709110000`: not applied live; repair would hide missing phase columns/index.

Before any repair:

1. Run the read-only validation draft.
2. Capture validation output.
3. Approve the exact repair candidate list.
4. Run repair only for approved APPLIED/APPLIED_WITH_DRIFT versions.
5. Re-run `supabase migration list`.
6. Confirm no dangerous historical migration remains pending before Phase Workflow Foundation review.
