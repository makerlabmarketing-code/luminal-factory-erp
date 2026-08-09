# Facility production reconciliation

Date: 2026-08-09
Production project: `kwfmfmpgpbfewpiizesv`
Repository baseline: `17599e3fae2bd34a8e6643c63e12da480ed4ee59`

## Result

The Facility directory schema, read authorization boundary, and current employee assignment compatibility are structurally healthy in production. This reconciliation is read-only.

### Migration and schema

Migration `20260723120000 facility_status_code` is already present in production migration history and was not replayed.

Production currently has 3 Facility rows. Every row has a non-empty stable `code`, `is_active = true`, and the delivered unique-code contract is present.

### Facility read authorization

RLS is enabled on `public.facilities`.

The production SELECT policy is:

- role: `authenticated`
- Admin access requires `ADMIN_WORKSPACE` plus one of `SYSTEM_SETTINGS_VIEW`, `ATTENDANCE_MANAGE`, or `EMPLOYEE_VIEW`
- Staff access requires `STAFF_WORKSPACE`

`authenticated` has SELECT table privilege. `anon` does not have SELECT privilege.

No RLS or GRANT change is required by this reconciliation.

### Employee assignment compatibility

There are 6 active employee profiles.

Read-only compatibility resolution using the repository contract (facility ID → stable code → facility name) returned:

- resolved assignments: `6`
- stable-code assignments: `3`
- legacy numeric-ID assignments: `3`
- unresolved assignments: `0`

The remaining numeric values are legacy assignments that resolve deterministically to existing Facility IDs, so the application can display and use them through its compatibility resolver.

They are **not** rewritten automatically. The existing facility compatibility decision record explicitly requires business confirmation before changing stored `employees.branch_code` values, even when a numeric value currently resolves to a Facility ID.

### Runtime gate

This reconciliation does not enable `FACILITY_ACTIVE_STATE_ENABLED`. Authenticated UI/Attendance smoke remains the activation gate for that flag.

## Safety

- migration replayed: no
- Facility rows mutated: `0`
- employee rows mutated: `0`
- RLS policies changed: `0`
- grants changed: `0`
- legacy assignment normalization performed: no

## Verification status

Migration/schema presence: **PASS**

Facility RLS/grant structure: **PASS**

Employee assignment resolvability: **PASS (6/6)**

Stable-code normalization: **DEFERRED FOR BUSINESS CONFIRMATION (3 legacy numeric assignments)**

Authenticated Facility/Attendance UI smoke: **STILL REQUIRED BEFORE RUNTIME ACTIVATION**
