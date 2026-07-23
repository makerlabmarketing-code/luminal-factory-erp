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

## 2026-07-22 corrective permission contract repair

Completed application-contract preparation before live permission-catalog rollout:

- Added the approved task keys `TASK_VIEW`, `TASK_MANAGE`, `TASK_ASSIGN`, and `TASK_REVIEW` to the canonical TypeScript permission contract, grouping registry, Vietnamese labels, account-management editor source, server mutation whitelist, effective-permission counting, and preset detection path.
- Added only the approved reimbursement keys `REIMBURSEMENT_SUBMIT`, `REIMBURSEMENT_REVIEW`, `REIMBURSEMENT_APPROVE`, and `REIMBURSEMENT_MARK_PAID`; no additional reimbursement permission key was invented and none was mapped to generic finance permissions.
- Updated presets conservatively: Administrator receives all ordinary application permissions; HR receives no reimbursement review/approval/payment by default; Project Manager and Creative Lead receive the approved task permissions; Staff receives only `TASK_VIEW` and `REIMBURSEMENT_SUBMIT` by default.
- Preset application still updates permission rows only and does not grant or revoke Staff/Admin workspace access.
- Reimbursement transition validation now models approval permission and payment-confirmation permission separately; requester self-approval/self-payment confirmation remains blocked by default.
- Repaired the Slice 5 reviewed SQL artifacts so the forward package only adds the approved eight keys, rollback refuses to remove keys that are referenced by employee permission rows, and validation checks contract parity, approved preset mappings, unchanged workspace grants, System Owner protection, unexpected access, and DENY precedence.

No SQL was executed. No live permission data was mutated. Stop condition remains `LIVE_APPROVAL_REQUIRED` before applying the reviewed permission-catalog package.

## 2026-07-22 live permission catalog rollout

LIVE approval was granted for only the reviewed eight-key permission catalog package and reviewed preset mappings. The forward artifact was applied through the Supabase Management API HTTPS database query path; no deployment was performed.

Pre-validation passed before execution:

- Required permission catalog and employee-permission columns matched the expected live schema.
- `public.permissions` retained its primary-key duplicate guard.
- The eight approved task/reimbursement keys were absent before forward execution.
- No existing `employee_permissions` rows referenced the approved keys before forward execution.
- `public.has_permission(text)` retained DENY precedence.

Post-validation passed after execution:

- The approved keys exist exactly once in `public.permissions`.
- The live catalog contains exactly the 25 canonical application permission keys and aligns with the application contract.
- Reviewed preset mappings contain only approved application keys.
- `employee_permissions` stayed at 17 rows and has no approved-key assignments.
- `employee_workspace_access` stayed at 4 rows.
- No workspace grant, employee permission assignment, preset application, System Owner row, RLS policy, schema object, backfill, deployment, or production workspace mutation was performed.

Rollback path: use `supabase/drafts/20260722_corrective_slice_5_permission_catalog_rollback.sql` only with separate live approval. The rollback artifact refuses to remove approved catalog keys once employee permission rows reference them.

## 2026-07-22 live validation remediation

A self-review of the latest-main live catalog rollout artifacts found one actionable validation weakness: the unexpected-access check used `created_at >= statement_timestamp()`, which could miss approved-key `employee_permissions` rows created before the validation statement. The validation artifact now fails whenever any employee permission row references the eight approved task/reimbursement keys, matching the live rollout acceptance condition that no account received those assignments.

No SQL was executed. No live permission catalog row, employee permission row, workspace grant, RLS policy, schema object, backfill, deployment, or production data was mutated. Corrective Slice 6 was not started.

## 2026-07-22 consolidated review-debt remediation sweep

The latest-main account-management grant paths were hardened so an otherwise idempotent workspace grant or permission-state save no longer leaves duplicate active rows untouched after finding one existing row. `grantWorkspace` and `setPermissionState` now load all matching active rows in deterministic ID order, retain the first row, and revoke any duplicate active rows before returning success.

No permission expansion, preset semantics change, workspace grant/backfill, SQL, RLS, schema mutation, deployment, or live data mutation was performed. The new remediation status remains `FIXED_PENDING_REVIEW` until a fresh Codex Code Review result is available for the remediation PR.

## 2026-07-23 review remediation sweep

Reviewed the current latest-main Slice 5 account-management evidence without reopening entries already classified as `ALREADY_FIXED_AND_VERIFIED`, `FALSE_POSITIVE_WITH_EVIDENCE`, or `REVIEW_SOURCE_UNAVAILABLE`. The remaining actionable duplicate-active-row finding is fixed in current code by collapsing duplicate active workspace and permission rows during idempotent grant/save paths. No permission expansion, preset semantics change, workspace grant/backfill, SQL, RLS, schema mutation, deployment, or production data mutation was performed. Final reviewed closure still depends on connected Codex Code Review availability for the active remediation PR.


## 2026-07-23 latest PR review closure

Reviewed the latest PR diff/comment bundle for the current remediation commit. No inline comment or newly actionable Codex Code Review finding was present for Slice 5. The duplicate-active-row finding remains fixed in code and covered by regression evidence, so Slice 5 is closed for this documentation-only remediation sweep. No permission expansion, SQL, RLS, schema mutation, deployment, production-data mutation, or Slice 7 work was performed.
