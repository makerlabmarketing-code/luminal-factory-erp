begin;

alter table public.task_comments alter column task_id drop not null;
alter table public.task_comments drop constraint if exists task_comments_body_length_check;
alter table public.task_comments add constraint task_comments_body_length_check
  check (length(btrim(body)) between 1 and 2000);

alter table public.project_activity drop constraint if exists project_activity_activity_type_check;
alter table public.project_activity add constraint project_activity_activity_type_check check (activity_type in (
  'TASK_CREATED', 'TASK_UPDATED', 'TASK_ASSIGNED', 'STATUS_CHANGED', 'COMMENT_ADDED',
  'TASK_ASSIGNEE_CHANGED', 'TASK_REVIEWER_CHANGED', 'TASK_DEADLINE_CHANGED',
  'TASK_STATUS_CHANGED', 'TASK_PROGRESS_CHANGED', 'TASK_PHASE_CHANGED',
  'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_ROLE_CHANGED', 'PROJECT_MEMBER_REVOKED', 'COMMENT_CREATED'
));

create or replace function public.reject_project_history_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'project history is immutable' using errcode = '55000';
end;
$$;

drop trigger if exists task_comments_immutable on public.task_comments;
create trigger task_comments_immutable before update or delete on public.task_comments
for each row execute function public.reject_project_history_mutation();
drop trigger if exists project_activity_immutable on public.project_activity;
create trigger project_activity_immutable before update or delete on public.project_activity
for each row execute function public.reject_project_history_mutation();

revoke insert, update, delete on public.task_comments from anon, authenticated;
revoke insert, update, delete on public.project_activity from anon, authenticated;

commit;
