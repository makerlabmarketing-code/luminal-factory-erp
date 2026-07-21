begin;

alter table public.projects add column if not exists project_code text;

update public.projects
set project_code = 'LEGACY-' || id::text
where project_code is null;

alter table public.projects alter column project_code set not null;

alter table public.projects
  add constraint projects_project_code_not_blank check (length(btrim(project_code)) > 0) not valid;
alter table public.projects validate constraint projects_project_code_not_blank;

create unique index if not exists projects_project_code_unique_idx on public.projects (upper(btrim(project_code)));

create or replace function public.create_project_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_employee_id bigint;
  v_project_name text;
  v_project_code text;
  v_status text;
  v_deadline date;
  v_project_id bigint;
  v_phase jsonb;
  v_phase_id bigint;
  v_task jsonb;
  v_task_id bigint;
  v_subtask jsonb;
  v_subtask_id bigint;
  v_assignee bigint;
  v_parent bigint;
  v_task_status text;
  v_note text;
  v_phase_map jsonb := '{}'::jsonb;
  v_task_map jsonb := '{}'::jsonb;
  v_task_key text;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.');
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.auth_user_id = v_actor and coalesce(e.is_active, true) = true and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
  limit 1;

  if v_employee_id is null then
    return jsonb_build_object('success', false, 'code', 'actor_not_allowed', 'message', 'Không thể xác định nhân sự thao tác.');
  end if;

  if not (public.has_workspace_access('ADMIN_WORKSPACE') and public.has_permission('PROJECT_MANAGE')) then
    return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền tạo dự án.');
  end if;

  if p_payload ? 'actorEmployeeId' or p_payload ? 'actor_employee_id' or p_payload ? 'createdByEmployeeId' then
    return jsonb_build_object('success', false, 'code', 'client_actor_rejected', 'message', 'Dữ liệu người thao tác không hợp lệ.');
  end if;

  v_project_name := nullif(btrim(coalesce(p_payload->>'projectName', p_payload->>'project_name')), '');
  v_project_code := upper(nullif(btrim(coalesce(p_payload->>'projectCode', p_payload->>'project_code')), ''));
  v_status := upper(nullif(btrim(coalesce(p_payload->>'status', 'PROCESSING')), ''));

  if v_project_name is null then return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Vui lòng nhập tên dự án.'); end if;
  if v_project_code is null then return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Vui lòng nhập mã dự án duy nhất.'); end if;
  if v_status not in ('DRAFT','PLANNING','PROCESSING','IN_PROGRESS','BLOCKED','ON_HOLD','COMPLETED','ARCHIVED','CANCELLED') then
    return jsonb_build_object('success', false, 'code', 'invalid_project_status', 'message', 'Trạng thái dự án không hợp lệ.');
  end if;
  if p_payload ? 'projectDeadline' and nullif(p_payload->>'projectDeadline','') is not null then
    v_deadline := (p_payload->>'projectDeadline')::date;
  end if;

  insert into public.projects(project_name, project_code, status, drive_url, project_deadline)
  values (v_project_name, v_project_code, v_status, '', v_deadline)
  returning id into v_project_id;

  insert into public.project_members(project_id, employee_id, role_code, status, granted_by_employee_id)
  values (v_project_id, v_employee_id, 'PROJECT_OWNER', 'ACTIVE', v_employee_id)
  on conflict do nothing;

  for v_assignee in select jsonb_array_elements_text(coalesce(p_payload->'memberEmployeeIds','[]'::jsonb))::bigint loop
    if not exists (select 1 from public.employees e where e.id=v_assignee and coalesce(e.is_active,true)=true and coalesce(e.status,'ACTIVE')='ACTIVE') then
      raise exception 'invalid member' using errcode='P0001';
    end if;
    insert into public.project_members(project_id, employee_id, role_code, status, granted_by_employee_id)
    values (v_project_id, v_assignee, 'CONTRIBUTOR', 'ACTIVE', v_employee_id)
    on conflict do nothing;
  end loop;

  for v_phase in select * from jsonb_array_elements(coalesce(p_payload->'phases','[]'::jsonb)) loop
    insert into public.phases(project_id, name, order_index)
    values (v_project_id, nullif(btrim(v_phase->>'name'), ''), coalesce((v_phase->>'orderIndex')::int, 0)) returning id into v_phase_id;
    if v_phase ? 'clientId' then v_phase_map := v_phase_map || jsonb_build_object(v_phase->>'clientId', v_phase_id); end if;
  end loop;

  for v_task in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]'::jsonb)) loop
    v_task_key := coalesce(v_task->>'clientId', gen_random_uuid()::text);
    v_phase_id := null;
    if v_task ? 'phaseClientId' then v_phase_id := (v_phase_map->>(v_task->>'phaseClientId'))::bigint; end if;
    v_assignee := nullif(v_task->>'assigneeEmployeeId','')::bigint;
    if v_assignee is not null and not exists (select 1 from public.project_members pm join public.employees e on e.id=pm.employee_id where pm.project_id=v_project_id and pm.employee_id=v_assignee and pm.status='ACTIVE' and coalesce(e.is_active,true)=true and coalesce(e.status,'ACTIVE')='ACTIVE') then
      raise exception 'invalid assignee' using errcode='P0001';
    end if;
    v_task_status := upper(coalesce(nullif(v_task->>'status',''), 'BACKLOG'));
    if v_task_status not in ('BACKLOG','READY','IN_PROGRESS','PENDING_REVIEW','REVISION_REQUIRED','APPROVED','BLOCKED','ON_HOLD','COMPLETED','CANCELLED') then
      return jsonb_build_object('success', false, 'code', 'invalid_task_status', 'message', 'Trạng thái công việc không hợp lệ.');
    end if;
    insert into public.tasks(project_id, phase_id, project_name, assigned_to, current_phase, title, description, assignee_employee_id, deadline, status, created_by_employee_id, updated_by_employee_id, assigned_by_employee_id, assigned_at)
    values (v_project_id, v_phase_id, v_project_name, '', 'IN_PROG', nullif(btrim(v_task->>'title'), ''), nullif(v_task->>'description',''), v_assignee, nullif(v_task->>'deadline','')::timestamptz, v_task_status, v_employee_id, v_employee_id, case when v_assignee is null then null else v_employee_id end, case when v_assignee is null then null else now() end)
    returning id into v_task_id;
    v_task_map := v_task_map || jsonb_build_object(v_task_key, v_task_id);
    v_note := nullif(btrim(coalesce(v_task->>'note', v_task->>'comment')), '');
    if v_note is not null then insert into public.task_comments(task_id, project_id, employee_id, body) values (v_task_id, v_project_id, v_employee_id, v_note); end if;
    insert into public.project_activity(project_id, task_id, actor_employee_id, activity_type, payload) values (v_project_id, v_task_id, v_employee_id, 'TASK_CREATED', jsonb_build_object('status', v_task_status));
    if v_assignee is not null then insert into public.task_notifications(project_id, task_id, recipient_employee_id, notification_type, payload) values (v_project_id, v_task_id, v_assignee, 'TASK_ASSIGNED', jsonb_build_object('projectId', v_project_id)); end if;
    for v_subtask in select * from jsonb_array_elements(coalesce(v_task->'subtasks','[]'::jsonb)) loop
      v_assignee := nullif(v_subtask->>'assigneeEmployeeId','')::bigint;
      if v_assignee is not null and not exists (select 1 from public.project_members pm join public.employees e on e.id=pm.employee_id where pm.project_id=v_project_id and pm.employee_id=v_assignee and pm.status='ACTIVE' and coalesce(e.is_active,true)=true and coalesce(e.status,'ACTIVE')='ACTIVE') then raise exception 'invalid subtask assignee' using errcode='P0001'; end if;
      v_task_status := upper(coalesce(nullif(v_subtask->>'status',''), 'BACKLOG'));
      if v_task_status not in ('BACKLOG','READY','IN_PROGRESS','PENDING_REVIEW','REVISION_REQUIRED','APPROVED','BLOCKED','ON_HOLD','COMPLETED','CANCELLED') then return jsonb_build_object('success', false, 'code', 'invalid_task_status', 'message', 'Trạng thái công việc không hợp lệ.'); end if;
      insert into public.tasks(project_id, phase_id, parent_task_id, project_name, assigned_to, current_phase, title, description, assignee_employee_id, deadline, status, created_by_employee_id, updated_by_employee_id, assigned_by_employee_id, assigned_at)
      values (v_project_id, v_phase_id, v_task_id, v_project_name, '', 'IN_PROG', nullif(btrim(v_subtask->>'title'), ''), nullif(v_subtask->>'description',''), v_assignee, nullif(v_subtask->>'deadline','')::timestamptz, v_task_status, v_employee_id, v_employee_id, case when v_assignee is null then null else v_employee_id end, case when v_assignee is null then null else now() end)
      returning id into v_subtask_id;
    end loop;
  end loop;

  insert into public.project_activity(project_id, actor_employee_id, activity_type, payload)
  values (v_project_id, v_employee_id, 'PROJECT_CREATED', jsonb_build_object('projectCode', v_project_code));

  return jsonb_build_object('success', true, 'projectId', v_project_id, 'projectCode', v_project_code, 'deadlinePersisted', v_deadline is not null);
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
grant execute on function public.create_project_atomic(jsonb) to authenticated;
comment on function public.create_project_atomic(jsonb) is 'Corrective Slice 3A transactional project creation RPC.';
commit;
