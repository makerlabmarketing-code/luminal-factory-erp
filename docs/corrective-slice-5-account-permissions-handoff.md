# Corrective Slice 5 Account, Workspace, Preset, and Permission Management Handoff

Date: 2026-07-22

## Completed application scope

- Kept employee profile, Auth connection, Staff Workspace, Admin Workspace, role preset, custom permission override rows, project membership roles, and protected System Owner status as separate concepts.
- Hardened account-management mutations so server-side identity and `ACCOUNT_MANAGE` remain required, System Owner rows are blocked from ordinary account-management mutation, self-lockout is rejected, unknown permission keys are rejected, no-op workspace/permission/preset writes are rejected, DENY still wins over ALLOW, and duplicate active permission/workspace rows are avoided by checking active rows before insert.
- Changed preset application to update permission rows only. Preset changes no longer silently grant or revoke Staff Workspace or Admin Workspace.
- Rebalanced approved application presets: HR no longer receives finance/project administration automatically; Project Manager no longer receives global employee/finance permissions; Creative Lead receives review/assignment-oriented project permissions without global project management; Custom is explicit and visible.
- Improved Vietnamese account-management UI copy and actions so the compact menu reflects valid invite/reset/workspace/revoke actions and the permission editor avoids English-only permission state labels.

## Approval boundary retained

No schema, RLS, migration, backfill, Auth live mutation, destructive cleanup, production SQL, or live permission mutation was executed in this slice.

## LIVE_APPROVAL_REQUIRED artifacts

The current approved live permission catalog does not contain task-domain keys (`TASK_VIEW`, `TASK_MANAGE`, `TASK_ASSIGN`, `TASK_REVIEW`) or reimbursement-specific finance review/payment keys. Corrective Slice 5 therefore does not add those keys to runtime mutation payloads because doing so would require permission catalog schema/backfill coordination.

Prepared draft artifacts only:

- `supabase/drafts/20260722_corrective_slice_5_permission_catalog_forward.sql`
- `supabase/drafts/20260722_corrective_slice_5_permission_catalog_rollback.sql`
- `supabase/drafts/20260722_corrective_slice_5_permission_catalog_validation.sql`

Stop condition before running those artifacts: `LIVE_APPROVAL_REQUIRED`.

## Validation notes

Focused and full repository validation were run after the application changes. Review-source access remains unavailable in this environment, so any external Codex Code Review findings must be supplied or run by the operator before marking review remediation complete.

## Next slice

Stop after Corrective Slice 5. Do not start Production Order or any other roadmap slice from this handoff.
