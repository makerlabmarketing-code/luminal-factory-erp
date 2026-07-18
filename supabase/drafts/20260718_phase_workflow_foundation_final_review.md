# Phase Workflow Foundation Final Draft Review

Date: 2026-07-18

Status: review draft. No SQL, migration, db push, live data mutation, commit, push, or deploy was performed while creating this file.

## Draft Inventory

| Draft | Purpose | Current status | Overlap | Risk | Keep/Replace |
| --- | --- | --- | --- | --- | --- |
| `20260718_phase_workflow_foundation_final_forward.sql` | Final foundation forward draft. | New authority candidate. | Replaces earlier phase workflow schema drafts. | Needs live catalog validation before rollout. | Keep. |
| `20260718_phase_workflow_foundation_final_rollback.sql` | Destructive rollback draft with preconditions. | New rollback candidate. | Replaces earlier destructive rollback drafts. | Blocks rollback when operational data exists. | Keep. |
| `20260718_phase_workflow_foundation_final_validation.sql` | Post-rollout read-only validation. | New validation candidate. | Extends earlier validation with row-count regression and status rules. | Expected counts must be refreshed immediately before rollout. | Keep. |
| `20260718_phase_workflow_foundation_final_backfill_report.md` | Final backfill decision. | New authority for foundation backfill. | Replaces ACTIVE/IN_PROGRESS guessing drafts. | Conservative; requires manual transition after rollout. | Keep. |
| `20260718_phase_workflow_foundation_final_threat_model.md` | Final foundation threat model. | New threat model candidate. | Replaces earlier broad schema threat model. | Residual actor-context caveat documented. | Keep. |
| `20260718_phase_workflow_supersede_note.md` | Sidecar documentation for blocked historical migrations. | New sidecar. | Covers `20260704153000` and `20260709110000`. | Does not edit executable migration files. | Keep. |
| `20260716_phase_workflow_foundation_pre_run_forward.sql` | Earlier foundation pre-run forward. | Superseded by final draft. | Has `SKIPPED`; lacks final decision on `previous_phase_id`; similar RLS scope. | Status vocabulary drift. | Replace. |
| `20260716_phase_workflow_foundation_pre_run_rollback.sql` | Earlier rollback. | Superseded by final rollback. | Drops same foundation fields. | Less strict destructive precondition. | Replace. |
| `20260716_phase_workflow_foundation_pre_run_validation.sql` | Earlier validation. | Superseded by final validation. | Checks columns/constraints/indexes/policies. | Missing full row-count regression. | Replace. |
| `20260716_phase_workflow_foundation_pre_run_backfill_report.md` | Earlier backfill report. | Superseded by final backfill. | Mentions optional first phase `IN_PROGRESS`. | Business ambiguity. | Replace. |
| `20260716_phase_workflow_schema_migration_draft.sql` | Older Slice 2 schema draft. | Superseded. | Adds `previous_phase_id`; uses `ACTIVE`; performs DML backfill. | Status semantics conflict; DML guesses active phase. | Replace. |
| `20260716_phase_task_edit_capability_forward_draft.sql` | Broader phase + task assignment draft. | Deferred. | Touches tasks and phase fields. | Too broad for foundation; deadline `timestamptz`; task schema out of scope. | Replace/defer. |
| `20260716_project_detail_phase_workflow_template_proposal.sql` | Future template proposal. | Deferred. | Mentions previous phase and template schema. | Not foundation rollout. | Keep as future proposal only. |
| `20260717_migration_history_*` reports | Drift reconciliation audit trail. | Historical authority for repair/supersede evidence. | Documents old migration overlap. | Not executable. | Keep. |

## Final Field Decision

| Field | Required now | Type | Nullable | Default | Constraint | Index | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `status` | Yes | `text` | No | `'NOT_STARTED'` | `phases_status_check` | `(project_id, status, order_index)` | Minimal workflow state. |
| `description` | Yes | `text` | Yes | none | none | none | Lightweight operational context, not comments. |
| `deadline` | Yes | `date` | Yes | none | none | partial `deadline` | Phase deadline is date-level. |
| `assignee_employee_id` | Yes | `bigint` | Yes | none | FK to `employees(id)` | partial assignee | Stable employee assignment. |
| `started_at` | Yes | `timestamptz` | Yes | none | order check with completed | none | Server-controlled transition timestamp. |
| `completed_at` | Yes | `timestamptz` | Yes | none | completed status check, order check | none | Server-controlled completion timestamp. |
| `updated_at` | Yes | `timestamptz` | No | `now()` | not null | `updated_at` | Optimistic concurrency token. |
| `updated_by_employee_id` | Yes | `bigint` | Yes | none | FK to `employees(id)` | none | Last trusted actor when available. |
| `previous_phase_id` | No | n/a | n/a | n/a | n/a | n/a | Defer; derive sequence by `(project_id, order_index)`. |

## Status Model

Final allowed values:

- `NOT_STARTED`
- `IN_PROGRESS`
- `REVIEW`
- `BLOCKED`
- `COMPLETED`
- `CANCELLED`

Deferred:

- `READY`
- `SKIPPED`

Forbidden legacy values:

- `TODO`
- `DOING`
- `PROCESSING`

Exact check constraint:

```sql
check (status in (
  'NOT_STARTED',
  'IN_PROGRESS',
  'REVIEW',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
))
```

## Sequential Workflow Decision

Decision: derive phase order from `(project_id, order_index)` in this foundation.

No `previous_phase_id` is added now.

Reasoning:

- Lower migration risk.
- No recursive trigger/cycle logic in the first rollout.
- Current live data is already ordered by project/order.
- Future parallel/branching workflow is better represented by a separate dependency table.

## Assignee Decision

Decision: `phases.assignee_employee_id -> employees.id`.

Server must validate that the employee is active and has ACTIVE membership in the project before assignment.

Reasoning:

- Avoids coupling assignment history to revocable `project_members` rows.
- Keeps stable employee identity.
- Supports inactive employee history without breaking the relationship.
- Avoids email/full_name/text assignment authority.

## Deadline Decision

Decision: `deadline date`.

Reasoning:

- Current phase planning is day-level.
- Mobile/admin UX is simpler.
- Overdue checks can use local business date.
- If hour-level scheduling is later required, add a separate scheduled timestamp field.

## updated_at Strategy

Decision: database trigger maintains `updated_at`.

The client must not send `updated_at`. The server uses it as an optimistic concurrency token.

## RLS / Mutation Boundary

Decision:

- `public.phases` RLS enabled.
- SELECT only to `authenticated`.
- SELECT predicate: `public.can_view_project(project_id)`.
- No anon policy.
- No policy ALL.
- No browser INSERT/UPDATE/DELETE policy.
- Mutation remains server-boundary only.

## Supersede Plan

- Do not run `20260704153000`.
- Do not repair `20260704153000` as applied.
- Do not run `20260709110000`.
- Do not repair `20260709110000` as applied.
- Keep historical files.
- Use sidecar documentation in `20260718_phase_workflow_supersede_note.md`.

## Live Snapshot Caveat

No SQL was run during this final review.

REST/PostgREST probe confirmed:

- Current visible API schema has `id`, `project_id`, `name`, `order_index`, `created_at`.
- Foundation fields are absent: `description`, `status`, `deadline`, `assignee_employee_id`, `started_at`, `completed_at`, `updated_at`, `updated_by_employee_id`.
- Colorway/stage fields from `20260709110000` are absent.

REST count/sample returned 0 visible rows because unauthenticated/publishable-key access is RLS-filtered. This is not a full table row count.

Current PK/FK/index/constraint/RLS/policy/sample-row validation still requires approved read-only catalog SQL immediately before rollout.

## Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Live schema snapshot newly read | BLOCKED | REST schema probe ran, but full catalog/data snapshot needs read-only SQL. |
| Final field set decided | PASS | Listed above. |
| Status semantics unique | PASS | Final vocabulary excludes legacy and deferred values. |
| Old migrations no longer authority | PASS | Sidecar supersede note created. |
| Foundation draft avoids unsafe overlap | PASS | Only `public.phases` ALTER/RLS/trigger/function/grants. |
| No broad mutation policy | PASS | Forward creates SELECT-only policy. |
| Backfill avoids guessed completed state | PASS | All existing phases start `NOT_STARTED`. |
| Application authorization alignment | PASS | DB does not add browser mutation policy. |
| Rollback/validation present | PASS | Final rollback and validation drafts created. |
| No SQL run | PASS | No `supabase db query` or SQL script was executed. |

## Safe Rollout Command Draft

Do not run until approved and converted to a production migration file:

```powershell
npx.cmd supabase migration new phase_workflow_foundation
```

Then copy the approved forward SQL into the generated migration file and run only the approved rollout command for that generated version.
