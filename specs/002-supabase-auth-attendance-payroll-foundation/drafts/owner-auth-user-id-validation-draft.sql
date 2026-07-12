-- Batch 3C2 Owner identity validation draft.
-- SELECT-only. Safe to run as read-only validation after migration/backfill.
-- Does not print full email or full auth user id.

select jsonb_build_object(
  'schema_ready',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'auth_user_id'
    ),
  'fk_exists',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.employees'::regclass
        and conname = 'employees_auth_user_id_fkey'
    ),
  'unique_index_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'employees'
        and indexname = 'employees_auth_user_id_unique_not_null'
    ),
  'owner_employee_rows',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'employee_email_hash', substr(md5(lower(trim(e.email))), 1, 12),
        'role', e.role,
        'status', e.status,
        'is_active', e.is_active,
        'auth_user_id_prefix', case
          when e.auth_user_id is null then null
          else substr(e.auth_user_id::text, 1, 8) || '...'
        end,
        'auth_user_id_hash', case
          when e.auth_user_id is null then null
          else substr(md5(e.auth_user_id::text), 1, 12)
        end
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      where e.id = 3
    ),
  'owner_auth_rows',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'auth_user_id_prefix', substr(u.id::text, 1, 8) || '...',
        'auth_user_id_hash', substr(md5(u.id::text), 1, 12),
        'email_hash', substr(md5(lower(trim(u.email))), 1, 12),
        'created_at_present', u.created_at is not null,
        'invited_at_present', u.invited_at is not null,
        'confirmed_at_present', u.confirmed_at is not null,
        'email_confirmed_at_present', u.email_confirmed_at is not null,
        'last_sign_in_present', u.last_sign_in_at is not null
      ) order by u.created_at), '[]'::jsonb)
      from auth.users u
      where substr(md5(lower(trim(u.email))), 1, 12) = '02ebdc98273a'
    ),
  'duplicate_auth_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'auth_user_id_prefix', substr(auth_user_id::text, 1, 8) || '...',
        'auth_user_id_hash', substr(md5(auth_user_id::text), 1, 12),
        'employee_count', employee_count,
        'employee_internal_ids', employee_internal_ids
      )), '[]'::jsonb)
      from (
        select
          auth_user_id,
          count(*) as employee_count,
          jsonb_agg(id order by id) as employee_internal_ids
        from public.employees
        where auth_user_id is not null
        group by auth_user_id
        having count(*) > 1
      ) duplicates
    )
) as owner_identity_validation;

