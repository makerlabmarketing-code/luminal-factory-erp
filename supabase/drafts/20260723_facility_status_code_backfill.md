# Facility active-state and stable-code backfill plan

Status: `LIVE_APPROVAL_REQUIRED`.

## Backfill performed by the forward package

- Set `code` for existing rows from normalized `facility_name`.
- If `facility_name` is blank, use `FACILITY-<id>` as a deterministic fallback.
- Existing rows receive `is_active = true` through the non-null default.

## Manual review before approval

Before live execution, inspect for duplicate normalized facility names. If duplicates exist, assign reviewed unique codes manually in the forward package before applying it.

## Post-run checks

Run `20260723_facility_status_code_validation.sql` and confirm every check returns `PASS`.

## Rollback

Run rollback only if no facility has been marked inactive. If inactive rows exist, export/review the inactive-state decisions before approving any rollback.
