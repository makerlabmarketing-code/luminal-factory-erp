# Batch 3E1 own-row RLS security review

## Security goal

Staff users must see only their own employee profile and their own attendance rows. Admin access remains permission-gated and server-mediated where application code uses privileged workflows.

## Authorization model

- Employee own-row read: `employees.auth_user_id = auth.uid()` and active `STAFF_WORKSPACE` access.
- Attendance own-row access: existing policies use `employee_id = public.current_employee_id()` and active `STAFF_WORKSPACE` access.
- Admin attendance access: existing policies require `ADMIN_WORKSPACE` and `ATTENDANCE_VIEW` or `ATTENDANCE_MANAGE`.
- Admin employee-list access: existing policy requires `ADMIN_WORKSPACE` and `EMPLOYEE_VIEW`.

## Explicit non-goals

- No `TO authenticated` policy without row ownership or permission predicate.
- No anon policy.
- No grants beyond authenticated `SELECT` on `employees` needed for RLS-gated profile reads.
- No service-role exposure.
- No SECURITY DEFINER function changes.
- No payroll or finance authorization change.
- No attendance calculation or source-of-truth change.
- No Auth user, permission, workspace, employee, attendance, or payroll data mutation.
