# System Record Lifecycle Specification

**Prepared:** 2026-09-10  
**Scope:** `public.email_templates`, `public.system_metadata`

## Goal

Preserve operational history when an administrator removes a reusable system record. Normal administrators deactivate and reactivate records; only the single `OWNER` may permanently delete a record, and permanent deletion requires that the record is already inactive.

## Behavior contract

| State/action | Admin with manage permission | Owner | New operational use | History |
|---|---:|---:|---:|---:|
| View active | Yes | Yes | Included | Retained |
| Include inactive | Yes | Yes | Excluded | Visible on request |
| Deactivate/reactivate | Yes | Yes | Updated immediately | Actor and time retained while inactive |
| Permanently delete active | No | No | N/A | Blocked |
| Permanently delete inactive | No | Yes | N/A | Removed intentionally |

Lists show active records by default. Inactive records appear only when “Hiện ngừng hoạt động” is selected. Inactive email templates cannot be edited or sent; inactive metadata cannot be edited or offered for new finance, bank, or email-group choices.

## Data contract

Both tables receive:

- `is_active boolean not null default true`
- `deactivated_at timestamptz null`
- `deactivated_by_employee_id bigint null references employees(id) on delete set null`

The database check constraint requires active rows to have no deactivation metadata and inactive rows to have a deactivation timestamp. Application authorization remains server-owned; no browser write policy or grant is added.

## Compatibility and rollout

The server-only flag `SYSTEM_RECORD_LIFECYCLE_ENABLED` defaults closed. With the flag closed, existing selects and Owner-only permanent deletion remain compatible. Activation order:

1. Run the read-only preflight.
2. Deliver the tracked migration through the protected migration workflow.
3. Run post-deployment validation and authenticated smoke tests.
4. Set `SYSTEM_RECORD_LIFECYCLE_ENABLED=true` and redeploy.

Rollback requires disabling the flag first. Schema rollback is blocked while any inactive row exists, because dropping lifecycle columns would erase operational state.

## Non-goals

- No change to Project archive, Attendance cancellation, employee status, or finance attachment states.
- No mutation of existing Production rows in this slice.
- No automatic permanent deletion or retention timer.
