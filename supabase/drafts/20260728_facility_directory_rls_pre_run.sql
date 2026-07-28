-- READ ONLY. Facility Directory RLS/grant preflight. Do not enable the runtime flag.
begin transaction read only;

select c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'facilities';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'facilities'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'facilities'
order by policyname;

select
  to_regprocedure('public.has_workspace_access(text)') is not null as has_workspace_access_exists,
  to_regprocedure('public.has_permission(text)') is not null as has_permission_exists;

rollback;
