# Administration Information Architecture and Configuration Handoff

Date: 2026-07-23

## Scope delivered

- Regrouped the existing admin navigation by business domain while preserving existing route paths and deep links.
- Renamed technical menu/page language to Vietnamese operational labels:
  - `Danh Sách Cơ Sở & GPS` → `Cơ sở làm việc`
  - `Quản Lý Danh Mục DB` → `Danh mục hệ thống`
  - `Tài Khoản & Phân Quyền` → `Tài khoản & quyền truy cập`
  - `Gán Việc & Tiến Độ Phase` → `Công việc & tiến độ`
  - `Sổ Cái Vốn & Chi Tiêu` → `Sổ thu chi`
  - `Lịch Chấm Công Ca` → `Chấm công`
- Kept implemented URLs unchanged; no redirects or route renames were required.
- Kept attendance tied to the existing `facilities` table source used by the Staff Attendance API.
- Renamed the current catalog page primary title to `Danh mục hệ thống` and removed primary `DB` terminology.

## Catalog inventory notes

Initial static inspection found a mixture of canonical system contracts and configurable business catalogs. This slice did not move hardcoded values into editable data because doing so safely requires live catalog schema/backfill review.

- Core system contracts that must remain code-defined unless an approved specification changes them: permission codes, workspace codes, workflow state-machine statuses, audit/security policy keys.
- Existing configurable candidate area: `system_metadata` / `DEFAULT_SYSTEM_METADATA_CATEGORIES` remains the current compatibility source for business dictionaries.
- Derived records that should continue to come from domain tables: employees, facilities, projects, attendance history, finance ledger entries.

## Live boundary

No SQL, schema change, RLS mutation, RPC deployment, catalog backfill, facility data mutation, permission mutation, Auth mutation, destructive operation, production deployment, or live data mutation was executed.

`LIVE_APPROVAL_REQUIRED` remains required before converting additional hardcoded business catalogs into database-backed catalog rows or mutating facility/catalog RLS.

## Next safe follow-up

If approved as a separate PR, continue with server-backed facility CRUD hardening and active/inactive filtering using the existing `facilities` table, including forward/rollback/validation artifacts if the live schema does not already contain active-state and stable-code columns.

## 2026-07-23 Facility administration server-boundary follow-up

Completed as a safe application-only continuation:

- The admin facility page now calls `/api/admin/facilities` for list/create/update/delete instead of mutating `facilities` directly from the browser.
- Facility reads and mutations now pass through `services/server/adminFacilities.ts`, which requires `ADMIN_WORKSPACE` and system-settings or attendance-management permission checks.
- Facility reads use an explicit select list for the existing live columns: `id, facility_name, address, lat, lng, radius`.
- Staff Attendance remains tied to the existing shared `facilities` source for GPS matching.

No SQL, schema change, RLS mutation, RPC deployment, catalog backfill, facility live mutation outside the app request path, permission mutation, Auth mutation, destructive operation, production deployment, or backfill was executed.

Still pending for a separate approval gate: active/inactive facility state, stable facility codes, RLS/catalog changes, and any facility backfill. Those require forward, rollback, validation, compatibility, security, and backfill artifacts before `LIVE_APPROVAL_REQUIRED` can be resolved.

## 2026-07-23 Facility active-state and stable-code package

Prepared as draft-only artifacts; no SQL was executed and no forward SQL was promoted to `supabase/migrations/`.

Artifacts:

- `supabase/drafts/20260723_facility_status_code_forward.sql`
- `supabase/drafts/20260723_facility_status_code_rollback.sql`
- `supabase/drafts/20260723_facility_status_code_validation.sql`
- `supabase/drafts/20260723_facility_status_code_compatibility.md`
- `supabase/drafts/20260723_facility_status_code_security.md`
- `supabase/drafts/20260723_facility_status_code_backfill.md`

The package proposes `facilities.code`, `facilities.is_active`, a unique facility-code index, and an active-facility partial index. Existing application reads remain compatible because the current `id, facility_name, address, lat, lng, radius` contract is unchanged.

`LIVE_APPROVAL_REQUIRED` remains required before applying the package, promoting a reviewed forward migration for the Supabase GitHub Integration path, filtering inactive facilities in the app, or migrating employee branch matching to stable codes.

## 2026-07-23 Facility active-state GitHub Integration delivery

The reviewed facility active-state/stable-code package received scoped live approval for the Supabase GitHub Integration delivery path only.

Delivered rollout artifact:

- `supabase/migrations/20260723120000_facility_status_code.sql` is an exact promotion of `supabase/drafts/20260723_facility_status_code_forward.sql`.

Preserved safety artifacts:

- Rollback remains separate at `supabase/drafts/20260723_facility_status_code_rollback.sql`.
- Read-only post-deployment validation remains separate at `supabase/drafts/20260723_facility_status_code_validation.sql`.
- Compatibility, security, and backfill notes remain under `supabase/drafts/20260723_facility_status_code_*.md`.

No direct production SQL, `supabase db push`, live backfill, RLS mutation, permission mutation, Auth mutation, deployment, destructive operation, unrelated table change, application redesign, inactive-facility filtering, or employee branch remapping was performed. After protected-main merge and Supabase GitHub Integration delivery, run the validation SQL and record PASS/FAIL before enabling any application behavior that depends on `facilities.code` or `facilities.is_active`.

Rollback remains a separate live approval decision using the reviewed rollback artifact. The rollback script intentionally blocks if inactive facility rows exist.
