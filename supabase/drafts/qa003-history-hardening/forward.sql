-- QA-003 draft. Requires exact SQL approval; do not auto-promote to migrations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.task_comments, public.project_activity, public.phase_status_history in share row exclusive mode;

do $guard$
declare
  relation_name text;
  relation_id regclass;
begin
  if to_regprocedure('public.reject_project_history_mutation()') is not null then
    raise exception 'QA003 drift: history guard already exists';
  end if;
  foreach relation_name in array array['task_comments','project_activity','phase_status_history'] loop
    relation_id := to_regclass('public.' || relation_name);
    if not exists (select 1 from pg_class where oid = relation_id and relrowsecurity and relowner = 'postgres'::regrole) then
      raise exception 'QA003 drift: table/RLS/owner %', relation_name;
    end if;
    if exists (select 1 from pg_trigger where tgrelid = relation_id and not tgisinternal) then
      raise exception 'QA003 drift: unexpected history triggers on %', relation_name;
    end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=relation_name) <> 1
      or not exists (select 1 from pg_policies where schemaname='public' and tablename=relation_name
        and cmd='SELECT' and roles=array['authenticated']::name[] and permissive='PERMISSIVE'
        and qual='can_view_project(project_id)' and with_check is null) then
      raise exception 'QA003 drift: history read policy %', relation_name;
    end if;
    if pg_get_serial_sequence('public.' || relation_name, 'id') is distinct from 'public.' || relation_name || '_id_seq' then
      raise exception 'QA003 drift: history identity sequence %', relation_name;
    end if;
    if exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) acl
      where c.oid=relation_id and acl.grantee not in (0,'postgres'::regrole,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole)) then
      raise exception 'QA003 drift: unreviewed table grantee %', relation_name;
    end if;
  end loop;
  if exists (select 1 from public.task_comments h left join public.projects p on p.id=h.project_id
      left join public.tasks t on t.id=h.task_id where p.id is null or (h.task_id is not null and (t.id is null or t.project_id<>h.project_id)))
    or exists (select 1 from public.project_activity h left join public.projects p on p.id=h.project_id
      left join public.tasks t on t.id=h.task_id where p.id is null or (h.task_id is not null and (t.id is null or t.project_id<>h.project_id)))
    or exists (select 1 from public.phase_status_history h left join public.projects p on p.id=h.project_id
      left join public.phases ph on ph.id=h.phase_id where p.id is null or ph.id is null or ph.project_id<>h.project_id) then
    raise exception 'QA003 drift: orphan or cross-project history';
  end if;
end $guard$;

-- Invoker trigger has no data access and no elevated privileges.
create function public.reject_project_history_mutation()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $function$
begin
  raise exception 'Project history is immutable' using errcode = '55000';
end;
$function$;
alter function public.reject_project_history_mutation() owner to postgres;
revoke all on function public.reject_project_history_mutation() from public, anon, authenticated, service_role;

do $install$
declare relation_name text;
begin
  foreach relation_name in array array['task_comments','project_activity','phase_status_history'] loop
    execute format('create trigger qa003_history_immutable before update or delete on public.%I for each row execute function public.reject_project_history_mutation()', relation_name);
    -- TRUNCATE is not governed by row-level security or row triggers.
    execute format('create trigger qa003_history_no_truncate before truncate on public.%I for each statement execute function public.reject_project_history_mutation()', relation_name);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', relation_name);
    execute format('grant select on public.%I to authenticated', relation_name);
    execute format('grant select, insert on public.%I to service_role', relation_name);
    execute format('revoke all on sequence public.%I from public, anon, authenticated, service_role', relation_name || '_id_seq');
    execute format('grant usage, select on sequence public.%I to service_role', relation_name || '_id_seq');
  end loop;
end $install$;
commit;
