-- Data-preserving: refuses rollback after a project-created event is recorded.
begin;
set local lock_timeout = '5s';
lock table public.project_activity in access exclusive mode;
do $guard$ begin
  if exists(select 1 from public.project_activity where activity_type='PROJECT_CREATED') then
    raise exception 'Rollback blocked: preserve PROJECT_CREATED history; roll back application only';
  end if;
end $guard$;
alter table public.project_activity drop constraint project_activity_activity_type_check;
alter table public.project_activity add constraint project_activity_activity_type_check check (activity_type in (
  'TASK_CREATED','TASK_UPDATED','TASK_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED',
  'PRODUCTION_ORDER_CREATED','PRODUCTION_STAGE_ACTIVATED','PRODUCTION_STAGE_COMPLETED','PRODUCTION_STAGE_OVERRIDDEN'
));
commit;
