# Facility active-state and stable-code compatibility report

Status: `LIVE_APPROVAL_REQUIRED`.

## Current schema assumed by application code

Current application reads and writes only the existing `facilities` columns `id`, `facility_name`, `address`, `lat`, `lng`, and `radius`.

## Proposed schema

- Add `public.facilities.code text not null` after backfilling every existing row from `facility_name` or `FACILITY-<id>`.
- Add `public.facilities.is_active boolean not null default true`.
- Add a unique index on `code`.
- Add a partial index for active facilities.

## Compatibility plan

- Existing application code remains compatible before and after the migration because existing columns are unchanged.
- New application filtering should be wired only after the forward package is approved and validation passes.
- Staff Attendance GPS matching must continue reading the shared `facilities` table and should filter inactive rows only after business approval confirms that inactive facilities must no longer accept check-ins.
- Employee branch mapping can migrate from free-text/name matching toward stable `code` in a later application slice after the column exists.

## Data-loss risk

Forward migration has no intended data loss. Rollback is blocked if any row has `is_active = false`, because dropping that column would erase operational inactive-state history.
