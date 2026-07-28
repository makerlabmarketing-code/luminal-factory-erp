begin;
drop trigger if exists task_comments_immutable on public.task_comments;
drop trigger if exists project_activity_immutable on public.project_activity;
drop function if exists public.reject_project_history_mutation();
alter table public.project_activity drop constraint if exists project_activity_activity_type_check;
alter table public.project_activity add constraint project_activity_activity_type_check check (activity_type in ('TASK_CREATED','TASK_UPDATED','TASK_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED')) not valid;
-- Do not restore task_id NOT NULL until the operator confirms there are no project-level comments.
commit;
