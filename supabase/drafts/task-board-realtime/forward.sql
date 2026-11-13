begin;

do $$
begin
  if to_regclass('public.tasks') is null
    or to_regclass('realtime.messages') is null
    or to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null
    or to_regprocedure('public.is_project_member(bigint)') is null
    or to_regprocedure('public.has_workspace_access(text)') is null
    or to_regprocedure('public.has_permission(text)') is null
    or not exists (select 1 from pg_class where oid = 'realtime.messages'::regclass and relrowsecurity)
    or exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages')
  then
    raise exception 'Realtime prerequisites or policy baseline differ from the reviewed environment';
  end if;
end
$$;

create policy erp_task_board_receive on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and topic = realtime.topic()
  and case when realtime.topic() ~ '^erp:task-board:[1-9][0-9]{0,14}$' then
    (public.has_workspace_access('ADMIN_WORKSPACE')
      and (public.has_permission('PROJECT_VIEW') or public.has_permission('PROJECT_MANAGE')
        or public.is_project_member(split_part(realtime.topic(), ':', 3)::bigint)))
    or (public.has_workspace_access('STAFF_WORKSPACE')
      and public.is_project_member(split_part(realtime.topic(), ':', 3)::bigint))
  else false end
);

create schema erp_task_board_private;
revoke all on schema erp_task_board_private from public, anon, authenticated;

create function erp_task_board_private.broadcast_task_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'tasks-changed', 'erp:task-board:' || new.project_id, true);
  return null;
end
$$;
revoke all on function erp_task_board_private.broadcast_task_status() from public, anon, authenticated;
create trigger erp_task_board_status_changed
after update of status on public.tasks
for each row
when (new.project_id is not null and old.status is distinct from new.status)
execute function erp_task_board_private.broadcast_task_status();

commit;
