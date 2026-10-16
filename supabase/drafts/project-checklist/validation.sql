-- Read-only postflight.
select proname,prosecdef,proconfig from pg_proc where oid in (
 'public.create_project_atomic(jsonb)'::regprocedure,
 'public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean)'::regprocedure,
 'public.save_project_template_atomic(bigint,text)'::regprocedure);
select has_function_privilege('anon','public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean)','execute') as anon_staff,
 has_function_privilege('authenticated','public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean)','execute') as browser_staff,
 has_function_privilege('anon','public.save_project_template_atomic(bigint,text)','execute') as anon_template;
