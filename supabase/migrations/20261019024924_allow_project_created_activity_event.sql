-- Approval required: add only the event emitted by create_project_atomic.
begin;
set local lock_timeout = '5s';
do $guard$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_activity'::regclass
      and conname = 'project_activity_activity_type_check'
      and convalidated
      and md5(pg_get_constraintdef(oid)) = 'f2e2d8dd312e75c84d51ac9aadb109fd'
  ) then raise exception 'Project activity constraint drift: review before applying'; end if;
end $guard$;
alter table public.project_activity drop constraint project_activity_activity_type_check;
alter table public.project_activity add constraint project_activity_activity_type_check check (activity_type in (
  'TASK_CREATED','TASK_UPDATED','TASK_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED',
  'PRODUCTION_ORDER_CREATED','PRODUCTION_STAGE_ACTIVATED','PRODUCTION_STAGE_COMPLETED','PRODUCTION_STAGE_OVERRIDDEN',
  'PROJECT_CREATED'
)) not valid;
alter table public.project_activity validate constraint project_activity_activity_type_check;
commit;
