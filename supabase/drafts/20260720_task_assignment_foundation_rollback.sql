-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE APPROVAL.
-- Rollback for 20260720_task_assignment_foundation_forward.sql.
-- Preconditions before execution:
-- 1. task_notifications, project_activity, and task_comments have no records that
--    must be preserved, or their export has been approved.
-- 2. normalized task columns are either empty or a legacy compatibility rollback
--    has been approved.

begin;

drop table if exists public.task_notifications;
drop table if exists public.project_activity;
drop table if exists public.task_comments;

drop index if exists public.tasks_deadline_idx;
drop index if exists public.tasks_assignee_employee_id_idx;
drop index if exists public.tasks_parent_task_id_idx;
drop index if exists public.tasks_project_phase_idx;
drop index if exists public.tasks_project_id_idx;

alter table public.tasks
  drop constraint if exists tasks_assignment_title_not_blank,
  drop constraint if exists tasks_assignment_status_check,
  drop column if exists updated_at,
  drop column if exists completed_at,
  drop column if exists assigned_at,
  drop column if exists assigned_by_employee_id,
  drop column if exists updated_by_employee_id,
  drop column if exists created_by_employee_id,
  drop column if exists status,
  drop column if exists deadline,
  drop column if exists assignee_employee_id,
  drop column if exists description,
  drop column if exists title,
  drop column if exists parent_task_id,
  drop column if exists phase_id,
  drop column if exists project_id;

commit;
