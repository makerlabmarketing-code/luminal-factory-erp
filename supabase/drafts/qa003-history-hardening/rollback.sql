-- Separate approval required. Leaves tightened grants/RLS and all rows intact.
-- This removes guards only; it deliberately does NOT regrant unsafe browser access.
begin;
set local lock_timeout = '5s';
lock table public.task_comments, public.project_activity, public.phase_status_history in share row exclusive mode;
do $rollback_guard$
declare relation_name text;
begin
  foreach relation_name in array array['task_comments','project_activity','phase_status_history'] loop
    if (select count(*) from pg_trigger where tgrelid=to_regclass('public.' || relation_name)
      and tgname in ('qa003_history_immutable','qa003_history_no_truncate')
      and tgfoid='public.reject_project_history_mutation()'::regprocedure) <> 2 then
      raise exception 'QA003 rollback drift: missing/unexpected guards %', relation_name;
    end if;
    execute format('drop trigger qa003_history_immutable on public.%I', relation_name);
    execute format('drop trigger qa003_history_no_truncate on public.%I', relation_name);
  end loop;
end $rollback_guard$;
drop function public.reject_project_history_mutation();
commit;
