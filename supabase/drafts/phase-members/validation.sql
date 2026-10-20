-- Read-only preflight: expect absent objects before first deployment.
select to_regclass('public.project_phase_members'), to_regclass('public.project_phase_member_audit');
-- Postflight: expect invoker=false, fixed search_path, RLS=true, no public access.
select proname, prosecdef, proconfig from pg_proc where oid=to_regprocedure('public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint)');
select relname, relrowsecurity from pg_class where oid in (to_regclass('public.project_phase_members'),to_regclass('public.project_phase_member_audit'));
select r, has_function_privilege(r,'public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint)','EXECUTE') as can_execute from unnest(array['anon','authenticated','service_role']) r;
select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('project_phase_members','project_phase_member_audit') order by table_name,grantee;
select count(*) as assignments from public.project_phase_members;
select count(*) as history from public.project_phase_member_audit;
select count(*) as orphan_assignments from public.project_phase_members m left join public.phases p on p.id=m.phase_id left join public.employees e on e.id=m.employee_id where p.id is null or e.id is null;
