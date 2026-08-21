-- Phase Template create_project_atomic replacement (REVIEW ONLY).
-- Requires 20260821_phase_template_forward.sql in the same transaction/package.
-- Stops if the production RPC baseline changed after the retained read-only review.

begin;

do $$
begin
  if to_regprocedure('public.create_project_atomic(jsonb)') is null then
    raise exception 'Phase Template stopped: create_project_atomic(jsonb) is missing.';
  end if;
  if md5(pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure))
     <> 'f893db4f9c021120ea697badda853cb9' then
    raise exception 'Phase Template stopped: live create_project_atomic(jsonb) baseline changed.';
  end if;
end $$;

create or replace function public.create_project_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_employee_id bigint;
  v_manager_employee_id bigint;
  v_project_name text;
  v_project_code text;
  v_status text;
  v_start_date date;
  v_deadline date;
  v_project_id bigint;
  v_phase jsonb;
  v_phase_id bigint;
  v_task jsonb;
  v_task_id bigint;
  v_subtask jsonb;
  v_subtask_id bigint;
  v_assignee bigint;
  v_assignee_name text;
  v_task_status text;
  v_note text;
  v_phase_map jsonb := '{}'::jsonb;
  v_task_map jsonb := '{}'::jsonb;
  v_task_key text;
  v_template_id bigint;
  v_template_version_id bigint;
  v_template_stage record;
  v_template_task record;
  v_template_stage_count integer := 0;
  v_template_task_count integer := 0;
  v_unassigned_task_count integer := 0;
  v_phase_start date;
  v_phase_end date;
  v_task_deadline date;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.');
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu dự án không hợp lệ.');
  end if;

  select employee.id into v_employee_id
  from public.employees employee
  where employee.auth_user_id = v_actor
    and coalesce(employee.is_active, true) = true
    and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
  limit 1;

  if v_employee_id is null then
    return jsonb_build_object('success', false, 'code', 'actor_not_allowed', 'message', 'Không thể xác định nhân sự thao tác.');
  end if;

  if not (public.has_workspace_access('ADMIN_WORKSPACE') and public.has_permission('PROJECT_MANAGE')) then
    return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền tạo dự án.');
  end if;

  if p_payload ? 'actorEmployeeId'
    or p_payload ? 'actor_employee_id'
    or p_payload ? 'createdByEmployeeId'
    or p_payload ? 'appliedByEmployeeId' then
    return jsonb_build_object('success', false, 'code', 'client_actor_rejected', 'message', 'Dữ liệu người thao tác không hợp lệ.');
  end if;

  v_project_name := nullif(btrim(coalesce(p_payload->>'projectName', p_payload->>'project_name')), '');
  v_project_code := upper(nullif(btrim(coalesce(p_payload->>'projectCode', p_payload->>'project_code')), ''));
  v_status := upper(nullif(btrim(coalesce(p_payload->>'status', 'PROCESSING')), ''));
  v_manager_employee_id := nullif(p_payload->>'managerEmployeeId', '')::bigint;
  v_template_version_id := nullif(p_payload->>'templateVersionId', '')::bigint;
  v_start_date := nullif(p_payload->>'startDate', '')::date;
  v_deadline := nullif(p_payload->>'projectDeadline', '')::date;

  if v_project_name is null then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Vui lòng nhập tên dự án.');
  end if;
  if v_project_code is null then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Vui lòng nhập mã dự án duy nhất.');
  end if;
  if v_status not in ('DRAFT','PLANNING','PROCESSING','IN_PROGRESS','BLOCKED','ON_HOLD','COMPLETED','ARCHIVED','CANCELLED') then
    return jsonb_build_object('success', false, 'code', 'invalid_project_status', 'message', 'Trạng thái dự án không hợp lệ.');
  end if;
  if v_manager_employee_id is null or not exists (
    select 1 from public.employees employee
    where employee.id = v_manager_employee_id
      and coalesce(employee.is_active, true) = true
      and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
  ) then
    return jsonb_build_object('success', false, 'code', 'invalid_manager', 'message', 'Người phụ trách không còn hoạt động.');
  end if;
  if v_start_date is not null and v_deadline is not null and v_start_date > v_deadline then
    return jsonb_build_object('success', false, 'code', 'invalid_date_order', 'message', 'Ngày bắt đầu không được sau hạn hoàn thành.');
  end if;

  if jsonb_typeof(coalesce(p_payload->'memberEmployeeIds', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_payload->'phases', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_payload->'tasks', '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Danh sách dự án không hợp lệ.');
  end if;

  for v_assignee in
    select jsonb_array_elements_text(coalesce(p_payload->'memberEmployeeIds', '[]'::jsonb))::bigint
  loop
    if not exists (
      select 1 from public.employees employee
      where employee.id = v_assignee
        and coalesce(employee.is_active, true) = true
        and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
    ) then
      return jsonb_build_object('success', false, 'code', 'invalid_member', 'message', 'Thành viên dự án không hợp lệ.');
    end if;
  end loop;

  if v_template_version_id is not null then
    if v_start_date is null then
      return jsonb_build_object('success', false, 'code', 'template_start_date_required', 'message', 'Vui lòng chọn ngày bắt đầu khi dùng mẫu giai đoạn.');
    end if;
    if v_deadline is null then
      return jsonb_build_object('success', false, 'code', 'template_deadline_required', 'message', 'Vui lòng chọn hạn hoàn thành khi dùng mẫu giai đoạn.');
    end if;
    if jsonb_array_length(coalesce(p_payload->'phases', '[]'::jsonb)) > 0
      or jsonb_array_length(coalesce(p_payload->'tasks', '[]'::jsonb)) > 0 then
      return jsonb_build_object('success', false, 'code', 'template_custom_workflow_conflict', 'message', 'Không thể dùng đồng thời mẫu và quy trình tùy chỉnh.');
    end if;

    select template.id into v_template_id
    from public.phase_template_versions version
    join public.phase_templates template on template.id = version.template_id
    where version.id = v_template_version_id
      and version.status = 'PUBLISHED'
      and template.status = 'ACTIVE'
      and template.project_type = 'GENERAL'
      and template.current_version_id = version.id
    for update of version, template;

    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'template_version_not_current', 'message', 'Mẫu giai đoạn không còn hiệu lực.');
    end if;

    select count(*), min(stage.order_index), max(stage.order_index)
      into v_template_stage_count, v_assignee, v_phase_id
    from public.phase_template_stages stage
    where stage.version_id = v_template_version_id;

    if v_template_stage_count = 0 or v_assignee <> 1 or v_phase_id <> v_template_stage_count then
      return jsonb_build_object('success', false, 'code', 'template_stage_order_invalid', 'message', 'Thứ tự giai đoạn trong mẫu không hợp lệ.');
    end if;

    if exists (
      select 1
      from public.phase_template_tasks task
      join public.phase_template_stages stage on stage.id = task.stage_id
      where stage.version_id = v_template_version_id
      group by task.stage_id
      having min(task.order_index) <> 1 or max(task.order_index) <> count(*)
    ) then
      return jsonb_build_object('success', false, 'code', 'template_task_order_invalid', 'message', 'Thứ tự công việc trong mẫu không hợp lệ.');
    end if;

    if exists (
      select 1
      from public.phase_template_stages stage
      left join public.phase_template_tasks task on task.stage_id = stage.id
      where stage.version_id = v_template_version_id
        and (
          (stage.start_offset_days is not null and v_start_date + stage.start_offset_days > v_deadline)
          or (stage.start_offset_days is not null and stage.duration_days is not null
            and v_start_date + stage.start_offset_days + stage.duration_days > v_deadline)
          or (stage.start_offset_days is not null and task.start_offset_days is not null
            and v_start_date + stage.start_offset_days + task.start_offset_days > v_deadline)
        )
    ) then
      return jsonb_build_object('success', false, 'code', 'template_deadline_overflow', 'message', 'Lịch trong mẫu vượt quá hạn hoàn thành dự án.');
    end if;
  else
    for v_task in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]'::jsonb)) loop
      v_task_status := upper(coalesce(nullif(v_task->>'status', ''), 'BACKLOG'));
      if v_task_status not in ('BACKLOG','READY','IN_PROGRESS','PENDING_REVIEW','REVISION_REQUIRED','APPROVED','BLOCKED','ON_HOLD','COMPLETED','CANCELLED') then
        return jsonb_build_object('success', false, 'code', 'invalid_task_status', 'message', 'Trạng thái công việc không hợp lệ.');
      end if;
      for v_subtask in select * from jsonb_array_elements(coalesce(v_task->'subtasks', '[]'::jsonb)) loop
        v_task_status := upper(coalesce(nullif(v_subtask->>'status', ''), 'BACKLOG'));
        if v_task_status not in ('BACKLOG','READY','IN_PROGRESS','PENDING_REVIEW','REVISION_REQUIRED','APPROVED','BLOCKED','ON_HOLD','COMPLETED','CANCELLED') then
          return jsonb_build_object('success', false, 'code', 'invalid_task_status', 'message', 'Trạng thái công việc không hợp lệ.');
        end if;
      end loop;
    end loop;
  end if;

  insert into public.projects(project_name, project_code, status, drive_url, start_date, project_deadline)
  values (v_project_name, v_project_code, v_status, '', v_start_date, v_deadline)
  returning id into v_project_id;

  insert into public.project_members(project_id, employee_id, role_code, status, granted_by_employee_id)
  values (v_project_id, v_employee_id, 'PROJECT_OWNER', 'ACTIVE', v_employee_id)
  on conflict do nothing;

  insert into public.project_members(project_id, employee_id, role_code, status, granted_by_employee_id)
  values (v_project_id, v_manager_employee_id, 'PROJECT_MANAGER', 'ACTIVE', v_employee_id)
  on conflict do nothing;

  for v_assignee in
    select jsonb_array_elements_text(coalesce(p_payload->'memberEmployeeIds', '[]'::jsonb))::bigint
  loop
    insert into public.project_members(project_id, employee_id, role_code, status, granted_by_employee_id)
    values (v_project_id, v_assignee, 'CONTRIBUTOR', 'ACTIVE', v_employee_id)
    on conflict do nothing;
  end loop;

  if v_template_version_id is not null then
    for v_template_stage in
      select stage.*
      from public.phase_template_stages stage
      where stage.version_id = v_template_version_id
      order by stage.order_index
    loop
      v_phase_start := case when v_template_stage.start_offset_days is null then null else v_start_date + v_template_stage.start_offset_days end;
      v_phase_end := case when v_phase_start is null or v_template_stage.duration_days is null then null else v_phase_start + v_template_stage.duration_days end;

      insert into public.phases(
        project_id, name, order_index, stage_type, planned_start_date,
        planned_end_date, progress, next_action, required_review
      )
      values (
        v_project_id, v_template_stage.name, v_template_stage.order_index - 1,
        'PHASE_TEMPLATE', to_char(v_phase_start, 'YYYY-MM-DD'),
        to_char(v_phase_end, 'YYYY-MM-DD'), 0,
        (select task.name from public.phase_template_tasks task where task.stage_id = v_template_stage.id order by task.order_index limit 1),
        v_template_stage.requires_review
      )
      returning id into v_phase_id;

      for v_template_task in
        select task.*
        from public.phase_template_tasks task
        where task.stage_id = v_template_stage.id
        order by task.order_index
      loop
        v_assignee := null;
        v_assignee_name := null;
        if v_template_task.assignee_role_code is not null then
          if v_template_task.assignee_role_code = 'PROJECT_MANAGER' then
            select membership.employee_id, employee.full_name
              into v_assignee, v_assignee_name
            from public.project_members membership
            join public.employees employee on employee.id = membership.employee_id
            where membership.project_id = v_project_id
              and membership.employee_id = v_manager_employee_id
              and membership.status = 'ACTIVE'
              and coalesce(employee.is_active, true) = true
              and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
            limit 1;
          else
            select membership.employee_id, employee.full_name
              into v_assignee, v_assignee_name
            from public.project_members membership
            join public.employees employee on employee.id = membership.employee_id
            where membership.project_id = v_project_id
              and membership.role_code = v_template_task.assignee_role_code
              and membership.status = 'ACTIVE'
              and coalesce(employee.is_active, true) = true
              and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
            order by membership.employee_id
            limit 1;
          end if;
        end if;
        if v_template_task.assignee_role_code is not null and v_assignee is null then
          v_unassigned_task_count := v_unassigned_task_count + 1;
        end if;

        v_task_deadline := case
          when v_template_stage.start_offset_days is null or v_template_task.start_offset_days is null then null
          else v_start_date + v_template_stage.start_offset_days + v_template_task.start_offset_days
        end;

        insert into public.tasks(
          project_id, phase_id, project_name, assigned_to, current_phase,
          title, description, assignee_employee_id, deadline, status,
          created_by_employee_id, updated_by_employee_id,
          assigned_by_employee_id, assigned_at, is_required, requires_review
        )
        values (
          v_project_id, v_phase_id, v_project_name, coalesce(v_assignee_name, ''), 'IN_PROG',
          v_template_task.name, v_template_task.description, v_assignee,
          v_task_deadline::timestamptz, 'BACKLOG', v_employee_id, v_employee_id,
          case when v_assignee is null then null else v_employee_id end,
          case when v_assignee is null then null else now() end,
          v_template_task.is_required, v_template_task.requires_review
        )
        returning id into v_task_id;

        v_template_task_count := v_template_task_count + 1;
        insert into public.project_activity(project_id, task_id, actor_employee_id, activity_type, payload)
        values (v_project_id, v_task_id, v_employee_id, 'TASK_CREATED', jsonb_build_object(
          'status', 'BACKLOG', 'templateVersionId', v_template_version_id,
          'assigneeRoleCode', v_template_task.assignee_role_code,
          'assigneeResolved', v_assignee is not null
        ));
        if v_assignee is not null then
          insert into public.task_notifications(project_id, task_id, recipient_employee_id, notification_type, payload)
          values (v_project_id, v_task_id, v_assignee, 'TASK_ASSIGNED', jsonb_build_object('projectId', v_project_id));
        end if;
      end loop;
    end loop;

    insert into public.phase_template_applications(
      project_id, template_id, version_id, applied_by_employee_id, clone_summary
    ) values (
      v_project_id, v_template_id, v_template_version_id, v_employee_id,
      jsonb_build_object(
        'startDate', v_start_date, 'projectDeadline', v_deadline,
        'phasesCreated', v_template_stage_count,
        'tasksCreated', v_template_task_count,
        'unassignedTasks', v_unassigned_task_count
      )
    );

    insert into public.phase_template_audit(
      template_id, version_id, actor_employee_id, action, after_data
    ) values (
      v_template_id, v_template_version_id, v_employee_id, 'APPLIED',
      jsonb_build_object('projectId', v_project_id, 'startDate', v_start_date, 'projectDeadline', v_deadline)
    );
  else
    for v_phase in select * from jsonb_array_elements(coalesce(p_payload->'phases', '[]'::jsonb)) loop
      insert into public.phases(project_id, name, order_index)
      values (v_project_id, nullif(btrim(v_phase->>'name'), ''), coalesce((v_phase->>'orderIndex')::int, 0))
      returning id into v_phase_id;
      if v_phase ? 'clientId' then
        v_phase_map := v_phase_map || jsonb_build_object(v_phase->>'clientId', v_phase_id);
      end if;
    end loop;

    for v_task in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]'::jsonb)) loop
      v_task_key := coalesce(v_task->>'clientId', gen_random_uuid()::text);
      v_phase_id := null;
      if v_task ? 'phaseClientId' then v_phase_id := (v_phase_map->>(v_task->>'phaseClientId'))::bigint; end if;
      v_assignee := nullif(v_task->>'assigneeEmployeeId', '')::bigint;
      if v_assignee is not null and not exists (
        select 1 from public.project_members membership
        join public.employees employee on employee.id = membership.employee_id
        where membership.project_id = v_project_id and membership.employee_id = v_assignee
          and membership.status = 'ACTIVE' and coalesce(employee.is_active, true) = true
          and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
      ) then raise exception 'invalid assignee' using errcode = 'P0001'; end if;
      v_task_status := upper(coalesce(nullif(v_task->>'status', ''), 'BACKLOG'));
      insert into public.tasks(project_id, phase_id, project_name, assigned_to, current_phase, title, description, assignee_employee_id, deadline, status, created_by_employee_id, updated_by_employee_id, assigned_by_employee_id, assigned_at)
      values (v_project_id, v_phase_id, v_project_name, '', 'IN_PROG', nullif(btrim(v_task->>'title'), ''), nullif(v_task->>'description', ''), v_assignee, nullif(v_task->>'deadline', '')::timestamptz, v_task_status, v_employee_id, v_employee_id, case when v_assignee is null then null else v_employee_id end, case when v_assignee is null then null else now() end)
      returning id into v_task_id;
      v_task_map := v_task_map || jsonb_build_object(v_task_key, v_task_id);
      v_note := nullif(btrim(coalesce(v_task->>'note', v_task->>'comment')), '');
      if v_note is not null then insert into public.task_comments(task_id, project_id, employee_id, body) values (v_task_id, v_project_id, v_employee_id, v_note); end if;
      insert into public.project_activity(project_id, task_id, actor_employee_id, activity_type, payload) values (v_project_id, v_task_id, v_employee_id, 'TASK_CREATED', jsonb_build_object('status', v_task_status));
      if v_assignee is not null then insert into public.task_notifications(project_id, task_id, recipient_employee_id, notification_type, payload) values (v_project_id, v_task_id, v_assignee, 'TASK_ASSIGNED', jsonb_build_object('projectId', v_project_id)); end if;
      for v_subtask in select * from jsonb_array_elements(coalesce(v_task->'subtasks', '[]'::jsonb)) loop
        v_assignee := nullif(v_subtask->>'assigneeEmployeeId', '')::bigint;
        if v_assignee is not null and not exists (
          select 1 from public.project_members membership
          join public.employees employee on employee.id = membership.employee_id
          where membership.project_id = v_project_id and membership.employee_id = v_assignee
            and membership.status = 'ACTIVE' and coalesce(employee.is_active, true) = true
            and coalesce(employee.status, 'ACTIVE') = 'ACTIVE'
        ) then raise exception 'invalid subtask assignee' using errcode = 'P0001'; end if;
        v_task_status := upper(coalesce(nullif(v_subtask->>'status', ''), 'BACKLOG'));
        insert into public.tasks(project_id, phase_id, parent_task_id, project_name, assigned_to, current_phase, title, description, assignee_employee_id, deadline, status, created_by_employee_id, updated_by_employee_id, assigned_by_employee_id, assigned_at)
        values (v_project_id, v_phase_id, v_task_id, v_project_name, '', 'IN_PROG', nullif(btrim(v_subtask->>'title'), ''), nullif(v_subtask->>'description', ''), v_assignee, nullif(v_subtask->>'deadline', '')::timestamptz, v_task_status, v_employee_id, v_employee_id, case when v_assignee is null then null else v_employee_id end, case when v_assignee is null then null else now() end)
        returning id into v_subtask_id;
      end loop;
    end loop;
  end if;

  insert into public.project_activity(project_id, actor_employee_id, activity_type, payload)
  values (v_project_id, v_employee_id, 'PROJECT_CREATED', jsonb_build_object(
    'projectCode', v_project_code, 'templateVersionId', v_template_version_id
  ));

  return jsonb_build_object(
    'success', true,
    'projectId', v_project_id,
    'projectCode', v_project_code,
    'deadlinePersisted', v_deadline is not null,
    'managerMembershipCreated', exists (
      select 1 from public.project_members membership
      where membership.project_id = v_project_id
        and membership.employee_id = v_manager_employee_id
        and membership.status = 'ACTIVE'
    ),
    'workflowCreated', v_template_version_id is not null
      or jsonb_array_length(coalesce(p_payload->'phases', '[]'::jsonb)) > 0,
    'phasesCreated', case when v_template_version_id is null then jsonb_array_length(coalesce(p_payload->'phases', '[]'::jsonb)) else v_template_stage_count end,
    'tasksCreated', case when v_template_version_id is null then jsonb_array_length(coalesce(p_payload->'tasks', '[]'::jsonb)) else v_template_task_count end,
    'unassignedTasks', v_unassigned_task_count
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'code', 'duplicate_project_code', 'message', 'Mã dự án đã tồn tại.');
  when invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu ngày hoặc mã nhân sự không hợp lệ.');
  when others then
    return jsonb_build_object('success', false, 'code', 'project_create_failed', 'message', 'Không thể tạo dự án đầy đủ.');
end;
$$;

revoke all on function public.create_project_atomic(jsonb) from public, anon;
grant execute on function public.create_project_atomic(jsonb) to authenticated, service_role;
comment on function public.create_project_atomic(jsonb) is
  'Atomic project creation with optional current Phase Template clone; actor is auth.uid()-derived.';

commit;
