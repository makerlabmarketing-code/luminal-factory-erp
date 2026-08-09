# Account / Workspace production reconciliation

Date: 2026-08-09
Production project: `kwfmfmpgpbfewpiizesv`
Repository baseline: `d98891bfe1be42d730d5c8ececebecfcb651e971`

## Result

The Employee Account / Workspace foundation is structurally healthy in production. This reconciliation is read-only and does not change employee, Auth, workspace, or permission data.

### Identity linkage

- 6 active employee profiles exist.
- 5 active employee profiles are linked to `auth.users` through `employees.auth_user_id`.
- Every existing employee/Auth link has the same normalized email on both sides.
- 1 active Staff profile is not linked to Auth yet. This is an operator onboarding state, not a database repair target, so no Auth user, invite, workspace, or permission was created automatically.

### Workspace and permission integrity

Production read-only checks returned:

- active workspace duplicate groups: `0`
- active permission duplicate groups: `0`
- unknown permission rows: `0`
- orphan workspace rows: `0`
- orphan permission rows: `0`
- employee/Auth email mismatch rows: `0`

Current access is explicit rather than inferred from `employees.role`. An ADMIN label alone therefore does not authorize an operation. `ADMIN_WORKSPACE` and the required application permission must both be present at the server boundary.

### Current operator shape

- Staff workspace is active for the linked Staff accounts currently using the Staff portal.
- Admin workspace exists for the three active Admin-labelled profiles.
- Only the existing account operator currently has `ACCOUNT_MANAGE`; no permissions were copied to other Admin-labelled profiles by this reconciliation.
- No preset was auto-applied.

## Safety decisions

No production mutation was performed because assigning an Auth account, workspace, or permission changes who can access ERP data. Those are explicit operator/business actions and must not be inferred from a display role.

No migration is required for this reconciliation.

## Remaining operator action

The Admin Accounts page already exposes the supported invite/link, workspace, preset, permission, password-reset, and revoke flows. The remaining operational item is to decide whether the currently unlinked Staff profile should be invited. That decision is deliberately not automated here.

## Verification status

Repository/application boundary: **PASS**

Production structural read-only reconciliation: **PASS**

Automatic grant/invite mutation: **NOT PERFORMED**

Business data affected: **0 rows**
