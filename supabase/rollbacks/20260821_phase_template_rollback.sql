-- Phase Template release-one safety rollback (REVIEW ONLY).
-- This rollback disables selection but intentionally preserves schema,
-- application provenance, audit history, and all cloned project rows.

begin;
select pg_advisory_xact_lock(hashtextextended('luminal:phase-template:v1', 0));

revoke execute on function public.manage_phase_template_atomic(jsonb)
from anon, authenticated;

update public.phase_templates
set status = 'ARCHIVED', current_version_id = null, updated_at = now()
where status <> 'ARCHIVED' or current_version_id is not null;

revoke all on table public.phase_templates, public.phase_template_versions,
  public.phase_template_stages, public.phase_template_tasks,
  public.phase_template_applications, public.phase_template_audit
from anon, authenticated;

-- Do not remove PHASE_TEMPLATE_MANAGE while an employee override references it.
-- Keep projects.start_date and the nullable task semantics columns: applied
-- projects are independent records and rollback must not erase their schedule.
-- Keep all Phase Template tables: provenance and audit are retention records.
commit;
