-- Corrective Slice 5 permission catalog expansion draft.
-- LIVE_APPROVAL_REQUIRED: do not execute without explicit live approval.
-- Forward plan:
-- 1. Add approved task-domain permission keys to public.permissions.
-- 2. Add reimbursement review/payment keys only after business approval confirms exact key names.
-- 3. Do not backfill employee_permissions automatically in this artifact.

begin;

insert into public.permissions (code, description)
values
  ('TASK_VIEW', 'View project tasks and assigned operational task data'),
  ('TASK_MANAGE', 'Create and update project task records'),
  ('TASK_ASSIGN', 'Assign project tasks to eligible project members'),
  ('TASK_REVIEW', 'Review submitted project task work')
on conflict (code) do nothing;

commit;
