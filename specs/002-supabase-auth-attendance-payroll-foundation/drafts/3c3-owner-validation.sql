-- Batch 3C3 validation query.
-- SELECT-only. Does not print full email or full auth user id.

select jsonb_build_object(
  'auth_user_id_column_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'auth_user_id'
    ),
  'foreign_key_exists',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.employees'::regclass
        and conname = 'employees_auth_user_id_fkey'
        and contype = 'f'
    ),
  'unique_partial_index_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'employees'
        and indexname = 'employees_auth_user_id_unique_not_null'
    ),
  'owner_employee_mapping',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'role', e.role,
        'status', e.status,
        'is_active', e.is_active,
        'email_hash', substr(md5(lower(trim(e.email))), 1, 12),
        'auth_user_id_prefix', case
          when e.auth_user_id is null then null
          else substr(e.auth_user_id::text, 1, 8) || '...'
        end,
        'auth_user_id_hash', case
          when e.auth_user_id is null then null
          else substr(md5(e.auth_user_id::text), 1, 12)
        end,
        'matched_auth_user_count',
          (
            select count(*)
            from auth.users u
            where u.id = e.auth_user_id
              and substr(md5(lower(trim(u.email))), 1, 12) = substr(md5(lower(trim(e.email))), 1, 12)
          )
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      where e.id = 3
    ),
  'duplicate_auth_user_id_links',
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
    ),
  'orphan_auth_user_id_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'auth_user_id_prefix', substr(e.auth_user_id::text, 1, 8) || '...',
        'auth_user_id_hash', substr(md5(e.auth_user_id::text), 1, 12)
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      left join auth.users u on u.id = e.auth_user_id
      where e.auth_user_id is not null
        and u.id is null
    )
) as batch_3c3_identity_validation;

