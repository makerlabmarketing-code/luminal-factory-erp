# Batch 3E1 own-row RLS compatibility and backfill notes

## Current schema assumed

- `public.employees.auth_user_id` exists and maps an employee row to `auth.users.id`.
- `public.current_employee_id()` resolves the active employee through `auth.uid()` and `employees.auth_user_id`.
- `public.has_workspace_access(text)` and `public.has_permission(text)` are deployed from the access/permission foundation.
- Existing attendance recovery policies already protect `public.attendance` and `public.attendance_logs` with own-row Staff access plus Admin attendance permissions.

## Proposed compatibility behavior

The package adds only the missing Staff own-profile read policy on `public.employees` and defensively keeps RLS enabled on `employees`, `attendance`, and `attendance_logs`.

Existing application paths remain compatible:

1. Admin employee listing continues through the existing `employees admin employee view select` policy and server DTO boundary.
2. Staff Attendance continues to use `employee_id = public.current_employee_id()` on `attendance` and `attendance_logs`.
3. Staff own employee-profile reads become explicitly authorized by `employees.auth_user_id = auth.uid()` plus active `STAFF_WORKSPACE` access.
4. No payroll, finance, attendance-calculation, Auth-user, permission-row, or employee-data mutation is included.

## Backfill plan

No automated backfill is included in this package.

Before live approval, operators must confirm that every Staff user expected to read their own employee row has exactly one active employee row with `auth_user_id` populated. Unmapped employees remain unable to read an own profile through this policy until their approved identity mapping exists.

## Rollback and data-loss risk

Rollback drops only `employees staff own profile select`. It does not disable RLS, drop admin policies, remove attendance policies, or mutate data. Data-loss risk is none for this package because no DML is included.
