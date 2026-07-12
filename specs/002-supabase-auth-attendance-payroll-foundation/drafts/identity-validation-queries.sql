-- Batch 3B read-only validation query set.
-- SELECT-only. Do not include DDL/DML in this file.
-- Use a read-only SQL connection, Supabase CLI/MCP with read-only permissions,
-- or an equivalent metadata-only channel. Do not use service role just to audit.

-- ---------------------------------------------------------------------------
-- 1. Migration history
-- ---------------------------------------------------------------------------
-- Prefer CLI for migration history because hosted projects may not expose the
-- same migration-history table shape:
--
--   npx supabase migration list --linked
--
-- SQL existence check only:

select table_schema, table_name
from information_schema.tables
where table_schema in ('supabase_migrations', 'public')
  and table_name ilike '%migration%'
order by table_schema, table_name;

-- ---------------------------------------------------------------------------
-- 2. Employees columns
-- ---------------------------------------------------------------------------

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'employees'
order by ordinal_position;

-- ---------------------------------------------------------------------------
-- 3. Employees constraints and indexes
-- ---------------------------------------------------------------------------

select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.employees'::regclass
order by conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'employees'
order by indexname;

-- ---------------------------------------------------------------------------
-- 4. Duplicate employee_id audit
-- ---------------------------------------------------------------------------

select
  to_jsonb(e)->>'employee_id' as employee_id,
  count(*) as row_count,
  array_agg(id order by id) as employee_internal_ids
from public.employees e
where to_jsonb(e)->>'employee_id' is not null
  and nullif(trim(to_jsonb(e)->>'employee_id'), '') is not null
group by to_jsonb(e)->>'employee_id'
having count(*) > 1
order by row_count desc, to_jsonb(e)->>'employee_id';

-- ---------------------------------------------------------------------------
-- 5. Duplicate normalized email audit
-- ---------------------------------------------------------------------------

select
  substr(md5(lower(trim(email))), 1, 12) as normalized_email_hash,
  count(*) as row_count,
  array_agg(id order by id) as employee_internal_ids
from public.employees
where email is not null
  and nullif(trim(email), '') is not null
group by lower(trim(email))
having count(*) > 1
order by row_count desc, normalized_email_hash;

-- Emails that change when normalized. Review case/space inconsistencies before
-- any normalized unique index.
select
  id as employee_internal_id,
  to_jsonb(e)->>'employee_id' as employee_id,
  substr(md5(email), 1, 12) as email_hash,
  substr(md5(lower(trim(email))), 1, 12) as normalized_email_hash
from public.employees e
where email is not null
  and email <> lower(trim(email))
order by id;

-- Placeholder/shared emails. Adjust patterns after seeing live data.
select
  id as employee_internal_id,
  to_jsonb(e)->>'employee_id' as employee_id,
  substr(md5(email), 1, 12) as email_hash
from public.employees e
where email is not null
  and (
    lower(trim(email)) like 'test%@%'
    or lower(trim(email)) like 'demo%@%'
    or lower(trim(email)) like 'placeholder%@%'
    or lower(trim(email)) like 'noemail%@%'
    or lower(trim(email)) in ('n/a', 'na', 'none')
  )
order by id;

-- Employees without email.
select id as employee_internal_id, to_jsonb(e)->>'employee_id' as employee_id
from public.employees e
where email is null
   or nullif(trim(email), '') is null
order by id;

-- ---------------------------------------------------------------------------
-- 6. Auth users audit
-- ---------------------------------------------------------------------------

select count(*) as auth_user_count
from auth.users;

select
  substr(md5(lower(trim(email))), 1, 12) as normalized_email_hash,
  count(*) as auth_user_count,
  array_agg(id order by created_at) as auth_user_ids
from auth.users
where email is not null
  and nullif(trim(email), '') is not null
group by lower(trim(email))
having count(*) > 1
order by auth_user_count desc, normalized_email_hash;

-- Auth users without employee.
select u.id as auth_user_id, substr(md5(lower(trim(u.email))), 1, 12) as normalized_email_hash
from auth.users u
left join public.employees e
  on lower(trim(e.email)) = lower(trim(u.email))
where u.email is not null
  and nullif(trim(u.email), '') is not null
  and e.id is null
order by u.created_at;

-- ---------------------------------------------------------------------------
-- 7. Auth-user mapping dry-run
-- ---------------------------------------------------------------------------

with employee_email_counts as (
  select lower(trim(email)) as normalized_email, count(*) as employee_count
  from public.employees
  where email is not null
    and nullif(trim(email), '') is not null
  group by lower(trim(email))
),
auth_email_counts as (
  select lower(trim(email)) as normalized_email, count(*) as auth_count
  from auth.users
  where email is not null
    and nullif(trim(email), '') is not null
  group by lower(trim(email))
)
select
  e.id as employee_internal_id,
  to_jsonb(e)->>'employee_id' as employee_id,
  u.id as auth_user_id,
  substr(md5(lower(trim(e.email))), 1, 12) as normalized_email_hash,
  'certain' as mapping_status
from public.employees e
join auth.users u
  on lower(trim(u.email)) = lower(trim(e.email))
join employee_email_counts ee
  on ee.normalized_email = lower(trim(e.email))
join auth_email_counts ae
  on ae.normalized_email = lower(trim(e.email))
where ee.employee_count = 1
  and ae.auth_count = 1
  and (to_jsonb(e)->>'auth_user_id' is null or (to_jsonb(e)->>'auth_user_id')::uuid = u.id)
order by e.id;

-- Manual review: duplicates/conflicts/ambiguous data.
with employee_email_counts as (
  select lower(trim(email)) as normalized_email, count(*) as employee_count
  from public.employees
  where email is not null
    and nullif(trim(email), '') is not null
  group by lower(trim(email))
),
auth_email_counts as (
  select lower(trim(email)) as normalized_email, count(*) as auth_count
  from auth.users
  where email is not null
    and nullif(trim(email), '') is not null
  group by lower(trim(email))
)
select
  e.id as employee_internal_id,
  to_jsonb(e)->>'employee_id' as employee_id,
  substr(md5(lower(trim(e.email))), 1, 12) as normalized_email_hash,
  coalesce(ee.employee_count, 0) as employee_email_count,
  coalesce(ae.auth_count, 0) as auth_email_count,
  case
    when ee.employee_count > 1 then 'duplicate_employee_email'
    when ae.auth_count > 1 then 'duplicate_auth_email'
    when to_jsonb(e)->>'auth_user_id' is not null and u.id is null then 'existing_auth_user_id_no_email_match'
    else 'manual_review'
  end as mapping_status
from public.employees e
left join auth.users u
  on lower(trim(u.email)) = lower(trim(e.email))
left join employee_email_counts ee
  on ee.normalized_email = lower(trim(e.email))
left join auth_email_counts ae
  on ae.normalized_email = lower(trim(e.email))
where e.email is not null
  and nullif(trim(e.email), '') is not null
  and (
    coalesce(ee.employee_count, 0) > 1
    or coalesce(ae.auth_count, 0) > 1
    or (to_jsonb(e)->>'auth_user_id' is not null and u.id is null)
  )
order by e.id;

-- Cannot map automatically.
select
  e.id as employee_internal_id,
  to_jsonb(e)->>'employee_id' as employee_id,
  case
    when e.email is null or nullif(trim(e.email), '') is null then 'employee_missing_email'
    else 'no_matching_auth_user'
  end as mapping_status
from public.employees e
left join auth.users u
  on lower(trim(u.email)) = lower(trim(e.email))
where to_jsonb(e)->>'auth_user_id' is null
  and (
    e.email is null
    or nullif(trim(e.email), '') is null
    or u.id is null
  )
order by e.id;

-- ---------------------------------------------------------------------------
-- 8. RLS status and policy catalog
-- ---------------------------------------------------------------------------

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
  and c.relname in (
    'employees',
    'attendance',
    'attendance_logs',
    'attendance_corrections',
    'payroll_runs',
    'payroll_items',
    'wage_rate_history',
    'payroll_adjustments',
    'adjustments',
    'expenses',
    'financial_ledger',
    'projects',
    'project_members',
    'tasks',
    'audit_logs',
    'file_metadata',
    'objects',
    'buckets'
  )
order by schema_name, table_name;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- ---------------------------------------------------------------------------
-- 9. Storage buckets and storage policies
-- ---------------------------------------------------------------------------

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename in ('objects', 'buckets')
order by tablename, policyname;
