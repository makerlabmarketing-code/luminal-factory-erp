-- Read-only validation for Batch 3D2 system_settings broad-policy remediation.
-- Expected after rollout: zero broad anon/authenticated ALL policies remain.

with unsafe_policies as (
  select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'system_settings'
    and policyname in ('Allow anon all', 'Allow authenticated all')
)
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  count(*) as unsafe_policy_count,
  coalesce(jsonb_agg(to_jsonb(unsafe_policies) order by policyname), '[]'::jsonb) as unsafe_policies
from unsafe_policies;

select
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as status,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'system_settings';
