# Phase Status and Dependency Mutation Design

Date: 2026-07-21

## Active Phase 3 slice

Current slice: **Phase status/dependency mutation design**.

This slice is application-and-database planning only. It prepares the server mutation contract, migration package, rollback path, validation SQL, RLS impact, and audit-history requirements for sequential project phase workflow. It must stop at `LIVE_APPROVAL_REQUIRED` before any live SQL, RLS mutation, backfill, or production data mutation.

## Acceptance Criteria

- Transition validator remains at the server/domain boundary; the client may display allowed actions but never owns validity.
- Complete, lock, unlock, reopen, skip, cancel, and override-lock actions require authenticated authorization from the existing phase mutation boundary.
- Project `CANCELLED` remains readonly for non-view phase mutations.
- Cross-project phase IDs are rejected before any mutation.
- Sequential gating opens a phase only after its previous dependency satisfies the approved completion condition.
- Complete phase is allowed only when the phase has at least one task and all non-cancelled tasks are completed or approved under the approved task status map.
- Lock/unlock and override actions create audit entries with actor, old status, new status, reason, note, timestamp, and override flag.
- No role matrix expansion is included; `CREATIVE_LEAD` remains view-only until separately approved.
- No task assignment, membership, attendance, payroll, finance, or Auth behavior changes are included.

## Exit Criteria

- The mutation contract is documented before implementation.
- Forward, rollback, validation, and backfill/compatibility artifacts exist as draft-only files.
- RLS impact is explicit and does not introduce browser write policies.
- Audit-history minimum fields are defined.
- Regression boundaries are documented for Project Detail task assignment, membership capability, cancelled-project readonly behavior, and phase cross-project checks.
- Execution stops at `LIVE_APPROVAL_REQUIRED` before running SQL, RLS changes, backfill, deployment, or live data mutation.

## Proposed server mutation contract

Route family under existing phase mutation server boundary:

- `POST /api/admin/projects/:projectId/phases/:phaseId/status`

Payload:

```ts
{
  action: 'COMPLETE' | 'LOCK' | 'UNLOCK' | 'REOPEN' | 'SKIP' | 'CANCEL' | 'OVERRIDE_LOCK';
  reason: string;
  note?: string;
  expectedCurrentStatus?: 'ACTIVE' | 'LOCKED' | 'COMPLETED' | 'BLOCKED' | 'REVIEW' | 'CANCELLED';
}
```

Server responsibilities:

1. Parse and reject unknown fields.
2. Resolve `projectId` and `phaseId` as positive integers.
3. Call `requirePhaseMutationAccess` with the matching `PhaseAction`.
4. Load the phase and adjacent phases inside the same project.
5. Enforce project cancellation readonly.
6. Enforce transition matrix and sequential dependency checks.
7. Persist the phase status only after all side effects can be written.
8. Insert audit history in the same transaction/RPC.
9. Return the reloaded phase DTO; never return fake success.

## Phase status model

Use the application-facing status vocabulary already prepared by `lib/workflow-project-phase.ts`:

- `ACTIVE`
- `LOCKED`
- `COMPLETED`
- `BLOCKED`
- `REVIEW`
- `CANCELLED`

Initial compatibility mapping:

- Existing null or unrecognized legacy status requires pre-run report before migration.
- First phase in each project may become `ACTIVE` when not completed/cancelled.
- Later phases may become `LOCKED` until the previous phase is complete.
- Existing completed phases remain `COMPLETED` only if `completed_at` evidence exists or backfill report explicitly classifies them.

## Transition matrix

Allowed without override:

| Current | Action | Next | Requirements |
|---|---|---|---|
| `ACTIVE` | `COMPLETE` | `COMPLETED` | All required tasks complete/approved; reason required. |
| `ACTIVE` | `LOCK` | `LOCKED` | No in-progress mutation conflict; reason required. |
| `ACTIVE` | `CANCEL` | `CANCELLED` | Reason required. |
| `BLOCKED` | `UNLOCK` | `ACTIVE` | Block reason resolved; previous dependency complete. |
| `BLOCKED` | `CANCEL` | `CANCELLED` | Reason required. |
| `REVIEW` | `COMPLETE` | `COMPLETED` | Review accepted; all required tasks complete/approved. |
| `REVIEW` | `REOPEN` | `ACTIVE` | Reason required. |
| `LOCKED` | `UNLOCK` | `ACTIVE` | Previous dependency complete. |
| `COMPLETED` | `REOPEN` | `ACTIVE` | Reason required and next phase has not been completed unless override approved. |

Invalid by default:

- `LOCKED` -> `COMPLETED`
- `CANCELLED` -> any non-view status
- `COMPLETED` -> `LOCKED`
- Any transition that opens a phase while its previous dependency is not `COMPLETED` or explicitly skipped.
- Any transition that skips audit insertion.

Override lock is reserved for `PROJECT_OWNER`, `PROJECT_MANAGER`, and global project managers only through the existing server authorization boundary and must write `override_flag = true` with a reason and note.

## Database impact plan

Proposed new durable audit table:

- `public.phase_status_history`
  - `id bigint generated by default as identity primary key`
  - `project_id bigint not null references public.projects(id)`
  - `phase_id bigint not null references public.phases(id)`
  - `actor_employee_id bigint not null references public.employees(id)`
  - `action text not null`
  - `old_status text`
  - `new_status text not null`
  - `reason text not null`
  - `note text`
  - `override_flag boolean not null default false`
  - `created_at timestamptz not null default now()`

Proposed `public.phases` changes:

- Ensure `status` supports `ACTIVE`, `LOCKED`, `COMPLETED`, `BLOCKED`, `REVIEW`, `CANCELLED`.
- Keep/update `completed_at`, `updated_at`, and `updated_by_employee_id` as workflow evidence fields.
- Add indexes for `project_id, order_index`, `project_id, status`, and phase-history lookups.

## RLS impact

- No browser write policy is proposed.
- Phase mutations remain behind server routes and the privileged server client after authenticated authorization.
- Read policy for `phase_status_history` should allow users who can view the project through `public.can_view_project(project_id)`.
- Insert/update/delete policies for `phase_status_history` are not exposed to browser clients in this slice.

## Backfill and compatibility plan

1. Generate a read-only pre-run report for existing phase statuses, null statuses, duplicate order indexes, orphan project IDs, and projects with no phases.
2. Do not infer completion from display text alone.
3. Map only deterministic rows; unresolved rows must be reported before mutation.
4. Preserve legacy phase names and order indexes.
5. Do not change tasks, project memberships, employees, attendance, payroll, finance, or Auth rows.

## LIVE_APPROVAL_REQUIRED

Running the draft SQL, creating the history table, changing `public.phases.status`, backfilling phase statuses, adding RLS, or mutating live phase data requires explicit approval.
