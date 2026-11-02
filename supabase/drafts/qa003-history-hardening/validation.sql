begin transaction read only;
do $validate$
declare relation_name text; relation_id regclass; browser_role text; privilege_name text;
begin
  if not exists (select 1 from pg_proc where oid='public.reject_project_history_mutation()'::regprocedure
    and not prosecdef and proowner='postgres'::regrole and proconfig=array['search_path=pg_catalog'])
    or has_function_privilege('anon','public.reject_project_history_mutation()','EXECUTE')
    or has_function_privilege('authenticated','public.reject_project_history_mutation()','EXECUTE') then
    raise exception 'QA003 validation: history guard function security';
  end if;
  foreach relation_name in array array['task_comments','project_activity','phase_status_history'] loop
    relation_id := to_regclass('public.' || relation_name);
    if (select count(*) from pg_trigger where tgrelid=relation_id and not tgisinternal
      and tgname in ('qa003_history_immutable','qa003_history_no_truncate')
      and tgfoid='public.reject_project_history_mutation()'::regprocedure and tgenabled='O') <> 2 then
      raise exception 'QA003 validation: missing/enabled triggers %', relation_name;
    end if;
    if not exists (select 1 from pg_class where oid=relation_id and relrowsecurity)
      or (select count(*) from pg_policies where schemaname='public' and tablename=relation_name) <> 1
      or not exists (select 1 from pg_policies where schemaname='public' and tablename=relation_name
        and cmd='SELECT' and roles=array['authenticated']::name[] and qual='can_view_project(project_id)') then
      raise exception 'QA003 validation: read policy drift %', relation_name;
    end if;
    foreach browser_role in array array['anon','authenticated'] loop
      foreach privilege_name in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(browser_role, relation_id, privilege_name) then
          raise exception 'QA003 validation: browser privilege %.% %', relation_name, browser_role, privilege_name;
        end if;
      end loop;
      if has_sequence_privilege(browser_role, 'public.' || relation_name || '_id_seq', 'USAGE')
        or has_sequence_privilege(browser_role, 'public.' || relation_name || '_id_seq', 'SELECT')
        or has_sequence_privilege(browser_role, 'public.' || relation_name || '_id_seq', 'UPDATE') then
        raise exception 'QA003 validation: browser sequence access %', relation_name;
      end if;
    end loop;
    if has_table_privilege('anon',relation_id,'SELECT') or not has_table_privilege('authenticated',relation_id,'SELECT')
      or not has_table_privilege('service_role',relation_id,'SELECT') or not has_table_privilege('service_role',relation_id,'INSERT') then
      raise exception 'QA003 validation: read/append grant %', relation_name;
    end if;
    foreach privilege_name in array array['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('service_role',relation_id,privilege_name) then
        raise exception 'QA003 validation: service mutation grant %', relation_name;
      end if;
    end loop;
    if not has_sequence_privilege('service_role','public.' || relation_name || '_id_seq','USAGE')
      or not has_sequence_privilege('service_role','public.' || relation_name || '_id_seq','SELECT')
      or has_sequence_privilege('service_role','public.' || relation_name || '_id_seq','UPDATE') then
      raise exception 'QA003 validation: service sequence grant %', relation_name;
    end if;
  end loop;
end $validate$;
select 'task_comments' as relation, count(*) from public.task_comments
union all select 'project_activity', count(*) from public.project_activity
union all select 'phase_status_history', count(*) from public.phase_status_history;
rollback;
