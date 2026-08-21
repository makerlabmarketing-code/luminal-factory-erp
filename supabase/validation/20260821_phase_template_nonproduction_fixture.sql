-- NON-PRODUCTION ONLY: Phase Template authorization and atomicity fixture.
--
-- Never run this file on production. It intentionally creates projects,
-- templates, phases, tasks, activity, notifications, provenance, audit rows,
-- and a temporary forced-failure trigger. The enclosing transaction rolls all
-- rows and DDL back, but identity sequences can still advance.
--
-- Before execution, replace only these placeholders in the SQL runner:
--   <AUTHORIZED_AUTH_UUID>  active Employee with ADMIN_WORKSPACE,
--                           PHASE_TEMPLATE_MANAGE, and PROJECT_MANAGE
--   <DENIED_AUTH_UUID>      active mapped Employee without either manage grant
--   <MANAGER_EMPLOYEE_ID>   active Employee used for role resolution
--   <CONFIRMED_NON_PRODUCTION_ENVIRONMENT> one of LOCAL, STAGING, EPHEMERAL_TEST
-- Do not commit real Auth UUIDs or Employee IDs.

begin;

set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtextextended('luminal:phase-template:nonproduction-fixture:v1', 0));

do $$
declare
  v_environment text := upper('<CONFIRMED_NON_PRODUCTION_ENVIRONMENT>');
begin
  if v_environment not in ('LOCAL', 'STAGING', 'EPHEMERAL_TEST') then
    raise exception 'Fixture stopped: replace the non-production environment confirmation placeholder.';
  end if;

  if to_regclass('public.phase_templates') is null
    or to_regprocedure('public.manage_phase_template_atomic(jsonb)') is null
    or to_regprocedure('public.create_project_atomic(jsonb)') is null then
    raise exception 'Fixture stopped: Phase Template package is not installed.';
  end if;

  if has_function_privilege('anon', 'public.manage_phase_template_atomic(jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_project_atomic(jsonb)', 'EXECUTE') then
    raise exception 'Fixture stopped: anon can execute a privileged Phase Template RPC.';
  end if;

  if not has_function_privilege('authenticated', 'public.manage_phase_template_atomic(jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_project_atomic(jsonb)', 'EXECUTE') then
    raise exception 'Fixture stopped: authenticated RPC grants are missing.';
  end if;
end $$;

create function pg_temp.phase_template_fixture_forced_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'phase_template_fixture_forced_failure' using errcode = 'P0001';
end;
$$;

do $$
declare
  v_authorized_auth uuid := '<AUTHORIZED_AUTH_UUID>'::uuid;
  v_denied_auth uuid := '<DENIED_AUTH_UUID>'::uuid;
  v_manager_employee_id bigint := '<MANAGER_EMPLOYEE_ID>'::bigint;
  v_template_name text := '__fixture_phase_template_' || txid_current()::text;
  v_denied_template_name text := '__fixture_phase_template_denied_' || txid_current()::text;
  v_template_id bigint;
  v_version_one_id bigint;
  v_version_two_id bigint;
  v_version_three_id bigint;
  v_project_id bigint;
  v_result jsonb;
  v_count bigint;
  v_projects_before bigint;
  v_phases_before bigint;
  v_tasks_before bigint;
  v_applications_before bigint;
  v_audit_before bigint;
  v_success_code text := 'PTFX' || txid_current()::text || 'S';
  v_stale_code text := 'PTFX' || txid_current()::text || 'T';
  v_overflow_code text := 'PTFX' || txid_current()::text || 'O';
  v_conflict_code text := 'PTFX' || txid_current()::text || 'C';
  v_cross_project_code text := 'PTFX' || txid_current()::text || 'X';
  v_actor_code text := 'PTFX' || txid_current()::text || 'A';
  v_denied_code text := 'PTFX' || txid_current()::text || 'D';
  v_forced_code text := 'PTFX' || txid_current()::text || 'F';
  v_archived_code text := 'PTFX' || txid_current()::text || 'R';
begin
  select count(*) into v_projects_before from public.projects;
  select count(*) into v_phases_before from public.phases;
  select count(*) into v_tasks_before from public.tasks;
  select count(*) into v_applications_before from public.phase_template_applications;
  select count(*) into v_audit_before from public.phase_template_audit;

  if not exists (
    select 1 from public.employees employee
    where employee.auth_user_id = v_authorized_auth
      and coalesce(employee.is_active, true)
      and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
  ) then
    raise exception 'Fixture stopped: authorized Auth UUID is not mapped to an active Employee.';
  end if;

  if not exists (
    select 1 from public.employees employee
    where employee.auth_user_id = v_denied_auth
      and coalesce(employee.is_active, true)
      and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
  ) then
    raise exception 'Fixture stopped: denied Auth UUID is not mapped to an active Employee.';
  end if;

  if not exists (
    select 1 from public.employees employee
    where employee.id = v_manager_employee_id
      and coalesce(employee.is_active, true)
      and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
  ) then
    raise exception 'Fixture stopped: manager Employee is not active.';
  end if;

  perform set_config('request.jwt.claim.sub', v_authorized_auth::text, true);
  if not public.has_workspace_access('ADMIN_WORKSPACE')
    or not public.has_permission('PHASE_TEMPLATE_MANAGE')
    or not public.has_permission('PROJECT_MANAGE') then
    raise exception 'Fixture stopped: authorized actor lacks a required workspace or permission.';
  end if;

  -- Direct SQL NULL must fail closed even when the browser route is bypassed.
  v_result := public.manage_phase_template_atomic(null::jsonb);
  if v_result->>'code' <> 'payload_validation_failed' then
    raise exception 'Fixture failed: management NULL payload did not fail closed: %', v_result;
  end if;
  v_result := public.create_project_atomic(null::jsonb);
  if v_result->>'code' <> 'payload_validation_failed' then
    raise exception 'Fixture failed: project-create NULL payload did not fail closed: %', v_result;
  end if;

  -- Denied actor cannot create a template and leaves no audit/template row.
  perform set_config('request.jwt.claim.sub', v_denied_auth::text, true);
  if public.has_permission('PHASE_TEMPLATE_MANAGE') or public.has_permission('PROJECT_MANAGE') then
    raise exception 'Fixture stopped: denied actor unexpectedly has a manage permission.';
  end if;
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'CREATE_DRAFT', 'name', v_denied_template_name
  ));
  if v_result->>'code' <> 'permission_forbidden' then
    raise exception 'Fixture failed: denied template mutation was not rejected: %', v_result;
  end if;
  if exists (select 1 from public.phase_templates where name = v_denied_template_name) then
    raise exception 'Fixture failed: denied template mutation persisted a row.';
  end if;

  perform set_config('request.jwt.claim.sub', v_authorized_auth::text, true);

  -- Create and populate version one with contiguous stage/task order.
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'CREATE_DRAFT',
    'name', v_template_name,
    'description', 'Rollback-only Phase Template fixture'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: CREATE_DRAFT failed: %', v_result;
  end if;
  v_template_id := (v_result->>'templateId')::bigint;
  v_version_one_id := (v_result->>'versionId')::bigint;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'UPDATE_DRAFT',
    'versionId', v_version_one_id,
    'stages', jsonb_build_array(
      jsonb_build_object(
        'name', 'Chuẩn bị', 'orderIndex', 1, 'startOffsetDays', 0,
        'durationDays', 2, 'requiresReview', false,
        'tasks', jsonb_build_array(
          jsonb_build_object(
            'name', 'Công việc quản lý', 'orderIndex', 1,
            'startOffsetDays', 1, 'isRequired', true,
            'requiresReview', true, 'assigneeRoleCode', 'PROJECT_MANAGER'
          ),
          jsonb_build_object(
            'name', 'Công việc chưa phân công', 'orderIndex', 2,
            'startOffsetDays', 2, 'isRequired', false,
            'requiresReview', false, 'assigneeRoleCode', 'CREATIVE_LEAD'
          )
        )
      ),
      jsonb_build_object(
        'name', 'Hoàn thiện', 'orderIndex', 2, 'startOffsetDays', 3,
        'durationDays', 1, 'requiresReview', true,
        'tasks', jsonb_build_array(
          jsonb_build_object(
            'name', 'Kiểm tra cuối', 'orderIndex', 1,
            'startOffsetDays', 0, 'isRequired', true,
            'requiresReview', true
          )
        )
      )
    )
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: UPDATE_DRAFT failed: %', v_result;
  end if;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'PUBLISH', 'versionId', v_version_one_id,
    'reason', 'Fixture publish version one'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: PUBLISH version one failed: %', v_result;
  end if;

  -- Clone and publish version two so version one becomes stale.
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'CLONE_VERSION', 'sourceVersionId', v_version_one_id
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: CLONE_VERSION failed: %', v_result;
  end if;
  v_version_two_id := (v_result->>'versionId')::bigint;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'PUBLISH', 'versionId', v_version_two_id,
    'reason', 'Fixture publish version two'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: PUBLISH version two failed: %', v_result;
  end if;

  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture stale version', 'projectCode', v_stale_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_one_id
  ));
  if v_result->>'code' <> 'template_version_not_current'
    or exists (select 1 from public.projects where project_code = v_stale_code) then
    raise exception 'Fixture failed: stale version was not rejected atomically: %', v_result;
  end if;

  -- Deadline overflow and custom/cross-project input must leave no project.
  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture overflow', 'projectCode', v_overflow_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-02', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id
  ));
  if v_result->>'code' <> 'template_deadline_overflow'
    or exists (select 1 from public.projects where project_code = v_overflow_code) then
    raise exception 'Fixture failed: deadline overflow was not rejected atomically: %', v_result;
  end if;

  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture custom conflict', 'projectCode', v_conflict_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id,
    'phases', jsonb_build_array(jsonb_build_object('name', 'Không hợp lệ'))
  ));
  if v_result->>'code' <> 'template_custom_workflow_conflict'
    or exists (select 1 from public.projects where project_code = v_conflict_code) then
    raise exception 'Fixture failed: custom workflow conflict persisted data: %', v_result;
  end if;

  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture cross-project input', 'projectCode', v_cross_project_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id,
    'tasks', jsonb_build_array(jsonb_build_object('phaseId', 9223372036854775807, 'title', 'Không hợp lệ'))
  ));
  if v_result->>'code' <> 'template_custom_workflow_conflict'
    or exists (select 1 from public.projects where project_code = v_cross_project_code) then
    raise exception 'Fixture failed: cross-project input persisted data: %', v_result;
  end if;

  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture actor field', 'projectCode', v_actor_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id, 'actorEmployeeId', v_manager_employee_id
  ));
  if v_result->>'code' <> 'client_actor_rejected'
    or exists (select 1 from public.projects where project_code = v_actor_code) then
    raise exception 'Fixture failed: client actor field persisted data: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_denied_auth::text, true);
  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture denied actor', 'projectCode', v_denied_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id
  ));
  if v_result->>'code' <> 'permission_forbidden'
    or exists (select 1 from public.projects where project_code = v_denied_code) then
    raise exception 'Fixture failed: denied project actor persisted data: %', v_result;
  end if;
  perform set_config('request.jwt.claim.sub', v_authorized_auth::text, true);

  -- Successful clone proves order conversion, flags, role resolution, and audit.
  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture successful clone', 'projectCode', v_success_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true
    or (v_result->>'phasesCreated')::integer <> 2
    or (v_result->>'tasksCreated')::integer <> 3
    or (v_result->>'unassignedTasks')::integer <> 1 then
    raise exception 'Fixture failed: successful clone returned an invalid summary: %', v_result;
  end if;
  v_project_id := (v_result->>'projectId')::bigint;

  select count(*) into v_count from public.phases where project_id = v_project_id;
  if v_count <> 2 or not exists (
    select 1 from public.phases where project_id = v_project_id and order_index = 0
  ) or not exists (
    select 1 from public.phases where project_id = v_project_id and order_index = 1
  ) then
    raise exception 'Fixture failed: template order did not become contiguous zero-based phase order.';
  end if;

  select count(*) into v_count from public.tasks where project_id = v_project_id;
  if v_count <> 3 then
    raise exception 'Fixture failed: cloned task count is %, expected 3.', v_count;
  end if;
  if not exists (
    select 1 from public.tasks
    where project_id = v_project_id and title = 'Công việc quản lý'
      and assignee_employee_id = v_manager_employee_id
      and deadline::date = date '2099-01-02'
      and is_required is true and requires_review is true
  ) or not exists (
    select 1 from public.tasks
    where project_id = v_project_id and title = 'Công việc chưa phân công'
      and assignee_employee_id is null
      and deadline::date = date '2099-01-03'
      and is_required is false
  ) or not exists (
    select 1 from public.tasks
    where project_id = v_project_id and title = 'Kiểm tra cuối'
      and deadline::date = date '2099-01-04'
  ) then
    raise exception 'Fixture failed: role resolution, deadlines, or task flags are incorrect.';
  end if;

  if not exists (
    select 1 from public.projects
    where id = v_project_id and start_date = date '2099-01-01'
  ) or (select count(*) from public.phase_template_applications where project_id = v_project_id) <> 1
    or (select count(*) from public.phase_template_audit where action = 'APPLIED' and after_data->>'projectId' = v_project_id::text) <> 1
    or (select count(*) from public.project_activity where project_id = v_project_id and activity_type = 'TASK_CREATED') <> 3
    or (select count(*) from public.project_activity where project_id = v_project_id and activity_type = 'PROJECT_CREATED') <> 1
    or (select count(*) from public.task_notifications where project_id = v_project_id and notification_type = 'TASK_ASSIGNED') <> 1 then
    raise exception 'Fixture failed: schedule, provenance, audit, activity, or notification is incomplete.';
  end if;

  -- Force failure after project/phase/task writes but before provenance insert.
  execute 'create trigger phase_template_fixture_forced_failure '
    || 'before insert on public.phase_template_applications for each row '
    || 'execute function pg_temp.phase_template_fixture_forced_failure()';
  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture forced failure', 'projectCode', v_forced_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id
  ));
  execute 'drop trigger phase_template_fixture_forced_failure on public.phase_template_applications';
  if v_result->>'code' <> 'project_create_failed'
    or exists (select 1 from public.projects where project_code = v_forced_code)
    or exists (select 1 from public.project_activity where payload->>'projectCode' = v_forced_code) then
    raise exception 'Fixture failed: forced failure left partial data: %', v_result;
  end if;

  -- Archive blocks apply; restore re-establishes the same current version.
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'ARCHIVE', 'templateId', v_template_id,
    'reason', 'Fixture archive'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: ARCHIVE failed: %', v_result;
  end if;
  v_result := public.create_project_atomic(jsonb_build_object(
    'projectName', 'Fixture archived version', 'projectCode', v_archived_code,
    'status', 'PROCESSING', 'startDate', '2099-01-01',
    'projectDeadline', '2099-01-15', 'managerEmployeeId', v_manager_employee_id,
    'templateVersionId', v_version_two_id
  ));
  if v_result->>'code' <> 'template_version_not_current'
    or exists (select 1 from public.projects where project_code = v_archived_code) then
    raise exception 'Fixture failed: archived version remained applicable: %', v_result;
  end if;
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'RESTORE', 'versionId', v_version_two_id,
    'reason', 'Fixture restore'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: RESTORE failed: %', v_result;
  end if;

  -- Invalid order and duplicate names must roll back to the cloned draft.
  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'CLONE_VERSION', 'sourceVersionId', v_version_two_id
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true then
    raise exception 'Fixture failed: version-three clone failed: %', v_result;
  end if;
  v_version_three_id := (v_result->>'versionId')::bigint;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'UPDATE_DRAFT', 'versionId', v_version_three_id,
    'stages', jsonb_build_array(jsonb_build_object(
      'name', 'Sai thứ tự', 'orderIndex', 2, 'tasks', jsonb_build_array()
    ))
  ));
  if coalesce((v_result->>'success')::boolean, false) is true
    or (select count(*) from public.phase_template_stages where version_id = v_version_three_id) <> 2 then
    raise exception 'Fixture failed: invalid order did not roll back draft replacement: %', v_result;
  end if;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'UPDATE_DRAFT', 'versionId', v_version_three_id,
    'stages', jsonb_build_array(
      jsonb_build_object('name', 'Trùng tên', 'orderIndex', 1, 'tasks', jsonb_build_array()),
      jsonb_build_object('name', ' trùng tên ', 'orderIndex', 2, 'tasks', jsonb_build_array())
    )
  ));
  if coalesce((v_result->>'success')::boolean, false) is true
    or (select count(*) from public.phase_template_stages where version_id = v_version_three_id) <> 2 then
    raise exception 'Fixture failed: duplicate names did not roll back draft replacement: %', v_result;
  end if;

  v_result := public.manage_phase_template_atomic(jsonb_build_object(
    'action', 'DELETE_DRAFT', 'versionId', v_version_three_id,
    'reason', 'Fixture delete unused draft'
  ));
  if coalesce((v_result->>'success')::boolean, false) is not true
    or exists (select 1 from public.phase_template_versions where id = v_version_three_id) then
    raise exception 'Fixture failed: DELETE_DRAFT failed: %', v_result;
  end if;

  if (select count(*) from public.projects) <> v_projects_before + 1
    or (select count(*) from public.phases) <> v_phases_before + 2
    or (select count(*) from public.tasks) <> v_tasks_before + 3
    or (select count(*) from public.phase_template_applications) <> v_applications_before + 1
    or (select count(*) from public.phase_template_audit) <= v_audit_before then
    raise exception 'Fixture failed: final in-transaction row deltas are invalid.';
  end if;

  raise notice 'PHASE_TEMPLATE_NONPRODUCTION_FIXTURE_PASS template=%, project=%', v_template_id, v_project_id;
end $$;

select 'PHASE_TEMPLATE_NONPRODUCTION_FIXTURE_PASS' as result,
  'All fixture rows and DDL will now be rolled back.' as rollback_status;

rollback;
