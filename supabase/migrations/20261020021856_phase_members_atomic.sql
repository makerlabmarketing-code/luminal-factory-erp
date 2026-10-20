-- DRAFT: approval required. No existing business rows are changed/backfilled.
begin;
create table public.project_phase_members (
  phase_id bigint not null references public.phases(id),
  employee_id bigint not null references public.employees(id),
  assigned_by_employee_id bigint not null references public.employees(id),
  assigned_at timestamptz not null default now(),
  primary key (phase_id, employee_id)
);
create index project_phase_members_employee_idx on public.project_phase_members(employee_id, phase_id);
create table public.project_phase_member_audit (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id),
  phase_id bigint not null references public.phases(id),
  actor_employee_id bigint not null references public.employees(id),
  before_employee_ids bigint[] not null,
  after_employee_ids bigint[] not null,
  created_at timestamptz not null default now()
);
create index project_phase_member_audit_phase_idx on public.project_phase_member_audit(phase_id, id desc);
alter table public.project_phase_members enable row level security;
alter table public.project_phase_member_audit enable row level security;
revoke all on public.project_phase_members, public.project_phase_member_audit from public, anon, authenticated;
grant select, insert, delete on public.project_phase_members to service_role;
grant select, insert on public.project_phase_member_audit to service_role;
revoke all on sequence public.project_phase_member_audit_id_seq from public, anon, authenticated;
grant usage, select on sequence public.project_phase_member_audit_id_seq to service_role;
create function public.block_phase_member_audit_change() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'phase_member_audit_immutable'; end $$;
revoke all on function public.block_phase_member_audit_change() from public, anon, authenticated;
create trigger project_phase_member_audit_immutable before update or delete on public.project_phase_member_audit
for each row execute function public.block_phase_member_audit_change();

create function public.set_project_phase_members_atomic(
  p_project_id bigint, p_phase_id bigint, p_employee_ids bigint[],
  p_expected_employee_ids bigint[], p_actor_employee_id bigint
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_project_status text; v_phase_status text; v_actor_role text; v_authorized boolean;
  v_ids bigint[]; v_expected bigint[]; v_before bigint[];
begin
  if p_project_id is null or p_project_id <= 0 or p_phase_id is null or p_phase_id <= 0
    or p_actor_employee_id is null or p_actor_employee_id <= 0
    or p_employee_ids is null or p_expected_employee_ids is null
    or cardinality(p_employee_ids) > 100 or cardinality(p_expected_employee_ids) > 100
    or exists(select 1 from unnest(p_employee_ids || p_expected_employee_ids) x where x is null or x <= 0)
  then raise exception 'phase_members_invalid_input'; end if;
  select coalesce(array_agg(distinct x order by x), '{}'::bigint[]) into v_ids from unnest(p_employee_ids) x;
  select coalesce(array_agg(distinct x order by x), '{}'::bigint[]) into v_expected from unnest(p_expected_employee_ids) x;

  -- Same project-first lock order as the membership mutation RPC.
  select upper(coalesce(status,'')) into v_project_status from public.projects where id=p_project_id for update;
  if not found then raise exception 'phase_members_project_not_found'; end if;
  if v_project_status in ('CANCELLED','ARCHIVED') then raise exception 'phase_members_project_closed'; end if;
  select upper(coalesce(status,'')) into v_phase_status from public.phases where id=p_phase_id and project_id=p_project_id for update;
  if not found then raise exception 'phase_members_phase_mismatch'; end if;
  if v_phase_status in ('COMPLETED','CANCELLED') then raise exception 'phase_members_phase_closed'; end if;

  select upper(coalesce(role,'')) into v_actor_role from public.employees
    where id=p_actor_employee_id and coalesce(is_active,true) and upper(coalesce(status,'ACTIVE'))='ACTIVE' for share;
  if not found then raise exception 'phase_members_forbidden'; end if;
  v_authorized := v_actor_role in ('ADMIN','OWNER') or exists(
    select 1 from public.project_members where project_id=p_project_id and employee_id=p_actor_employee_id
      and status='ACTIVE' and role_code in ('PROJECT_OWNER','PROJECT_MANAGER')
  ) or (
    exists(select 1 from public.employee_workspace_access where employee_id=p_actor_employee_id and workspace='ADMIN_WORKSPACE' and status='ACTIVE' and revoked_at is null)
    and exists(select 1 from public.employee_permissions where employee_id=p_actor_employee_id and permission_code='PROJECT_MANAGE' and effect='ALLOW' and status='ACTIVE' and revoked_at is null)
    and not exists(select 1 from public.employee_permissions where employee_id=p_actor_employee_id and permission_code='PROJECT_MANAGE' and effect='DENY' and status='ACTIVE' and revoked_at is null)
  );
  if not v_authorized then raise exception 'phase_members_forbidden'; end if;

  select coalesce(array_agg(employee_id order by employee_id), '{}'::bigint[]) into v_before from public.project_phase_members where phase_id=p_phase_id;
  -- Retrying a completed request creates no extra audit entry.
  if v_before=v_ids then return jsonb_build_object('employeeIds',v_before); end if;
  if v_before<>v_expected then raise exception 'phase_members_stale'; end if;
  perform id from public.employees where id=any(v_ids) order by id for share;
  if exists(select 1 from unnest(v_ids) x where not exists(
    select 1 from public.project_members pm join public.employees e on e.id=pm.employee_id
    where pm.project_id=p_project_id and pm.employee_id=x and pm.status='ACTIVE'
      and coalesce(e.is_active,true) and upper(coalesce(e.status,'ACTIVE'))='ACTIVE'
  )) then raise exception 'phase_members_not_project_member'; end if;

  delete from public.project_phase_members where phase_id=p_phase_id and not(employee_id=any(v_ids));
  insert into public.project_phase_members(phase_id, employee_id, assigned_by_employee_id)
    select p_phase_id,x,p_actor_employee_id from unnest(v_ids) x on conflict(phase_id,employee_id) do nothing;
  insert into public.project_phase_member_audit(project_id,phase_id,actor_employee_id,before_employee_ids,after_employee_ids)
    values(p_project_id,p_phase_id,p_actor_employee_id,v_before,v_ids);
  return jsonb_build_object('employeeIds',v_ids);
end $$;
revoke all on function public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint) from public, anon, authenticated;
grant execute on function public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint) to service_role;
commit;
