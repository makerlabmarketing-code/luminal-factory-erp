-- PREPARATION ONLY. DO NOT promote or execute with NULL target identifiers.
-- Owner must confirm the currently signed-in ERP account BEFORE binding identifiers.
-- No role-based mass grant and no Commerce Supabase mutation.
begin;

do $$
declare
  v_target_employee_id bigint := null;  -- Replace after direct account verification.
  v_target_auth_user_id uuid := null;   -- Fetch from the matched Auth-linked employee privately.
  v_rows integer;
begin
  if v_target_employee_id is null or v_target_auth_user_id is null then
    raise exception 'STOP: ERP account identity has not been verified.';
  end if;

  select count(*) into v_rows
  from public.employees e
  where e.id = v_target_employee_id
    and e.auth_user_id = v_target_auth_user_id
    and e.status = 'ACTIVE'
    and coalesce(e.is_active, true);
  if v_rows <> 1 then
    raise exception 'STOP: employee/auth identity mismatch or inactive account.';
  end if;

  select count(*) into v_rows
  from public.employee_workspace_access w
  where w.employee_id = v_target_employee_id
    and w.workspace = 'ADMIN_WORKSPACE'
    and w.status = 'ACTIVE'
    and w.revoked_at is null;
  if v_rows <> 1 then
    raise exception 'STOP: target lacks exactly one active Admin Workspace grant.';
  end if;

  select count(*) into v_rows
  from public.employee_permissions p
  where p.employee_id = v_target_employee_id
    and p.permission_code = 'COMMERCE_PRODUCT_VIEW'
    and p.effect = 'DENY'
    and p.status = 'ACTIVE'
    and p.revoked_at is null;
  if v_rows <> 0 then
    raise exception 'STOP: target has an active DENY override.';
  end if;

  insert into public.permissions (code, description)
  values ('COMMERCE_PRODUCT_VIEW', 'Read-only Commerce product catalog via ERP Admin')
  on conflict (code) do nothing;

  -- Do not assign permission to other employees or group presets.\n  -- granted_by_employee_id intentionally remains NULL for a migration-driven grant;\n  -- never misattribute a database migration to the target account.
  insert into public.employee_permissions (
    employee_id, permission_code, effect, status
  )
  select v_target_employee_id, 'COMMERCE_PRODUCT_VIEW', 'ALLOW', 'ACTIVE'
  where not exists (
    select 1 from public.employee_permissions p
    where p.employee_id = v_target_employee_id
      and p.permission_code = 'COMMERCE_PRODUCT_VIEW'
      and p.effect = 'ALLOW'
      and p.status = 'ACTIVE'
      and p.revoked_at is null
  );

  select count(*) into v_rows
  from public.employee_permissions p
  where p.employee_id = v_target_employee_id
    and p.permission_code = 'COMMERCE_PRODUCT_VIEW'
    and p.effect = 'ALLOW'
    and p.status = 'ACTIVE'
    and p.revoked_at is null;
  if v_rows <> 1 then
    raise exception 'STOP: expected exactly one active Product view ALLOW.';
  end if;
end $$;

commit;
