-- Phase Template management RPC package (REVIEW ONLY).
-- Direct table writes remain revoked; authenticated execution is authorized
-- inside the SECURITY DEFINER function with auth.uid(), workspace, and
-- PHASE_TEMPLATE_MANAGE checks on every transaction.

begin;

create or replace function public.phase_template_validate_draft(p_version_id bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_stage_count integer;
  v_min_order integer;
  v_max_order integer;
begin
  if not exists (
    select 1 from public.phase_template_versions version
    where version.id = p_version_id and version.status = 'DRAFT'
  ) then
    raise exception 'phase_template_draft_required' using errcode = 'P0001';
  end if;

  select count(*), min(stage.order_index), max(stage.order_index)
    into v_stage_count, v_min_order, v_max_order
  from public.phase_template_stages stage
  where stage.version_id = p_version_id;

  if v_stage_count = 0 or v_min_order <> 1 or v_max_order <> v_stage_count then
    raise exception 'phase_template_stage_order_invalid' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.phase_template_tasks task
    join public.phase_template_stages stage on stage.id = task.stage_id
    where stage.version_id = p_version_id
    group by task.stage_id
    having min(task.order_index) <> 1 or max(task.order_index) <> count(*)
  ) then
    raise exception 'phase_template_task_order_invalid' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.manage_phase_template_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_employee_id bigint;
  v_action text := upper(nullif(btrim(p_payload->>'action'), ''));
  v_reason text := nullif(btrim(p_payload->>'reason'), '');
  v_template_id bigint := nullif(p_payload->>'templateId', '')::bigint;
  v_version_id bigint := nullif(p_payload->>'versionId', '')::bigint;
  v_source_version_id bigint := nullif(p_payload->>'sourceVersionId', '')::bigint;
  v_current_version_id bigint;
  v_new_version_number integer;
  v_stage jsonb;
  v_task jsonb;
  v_stage_id bigint;
  v_stage_order integer;
  v_task_order integer;
  v_before jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.');
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu mẫu không hợp lệ.');
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
  if not (public.has_workspace_access('ADMIN_WORKSPACE') and public.has_permission('PHASE_TEMPLATE_MANAGE')) then
    return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền quản lý mẫu giai đoạn.');
  end if;
  if p_payload ? 'actorEmployeeId'
    or p_payload ? 'actor_employee_id'
    or p_payload ? 'createdByEmployeeId'
    or p_payload ? 'updatedByEmployeeId'
    or p_payload ? 'publishedByEmployeeId' then
    return jsonb_build_object('success', false, 'code', 'client_actor_rejected', 'message', 'Dữ liệu người thao tác không hợp lệ.');
  end if;
  if v_action not in ('CREATE_DRAFT', 'UPDATE_DRAFT', 'CLONE_VERSION', 'PUBLISH', 'ARCHIVE', 'RESTORE', 'DELETE_DRAFT') then
    return jsonb_build_object('success', false, 'code', 'invalid_action', 'message', 'Thao tác mẫu không hợp lệ.');
  end if;
  if v_action in ('PUBLISH', 'ARCHIVE', 'RESTORE', 'DELETE_DRAFT') and v_reason is null then
    return jsonb_build_object('success', false, 'code', 'reason_required', 'message', 'Vui lòng nhập lý do thao tác.');
  end if;

  if v_action = 'CREATE_DRAFT' then
    if nullif(btrim(p_payload->>'name'), '') is null then
      return jsonb_build_object('success', false, 'code', 'name_required', 'message', 'Vui lòng nhập tên mẫu.');
    end if;
    insert into public.phase_templates(
      name, description, project_type, status,
      created_by_employee_id, updated_by_employee_id
    ) values (
      btrim(p_payload->>'name'), nullif(btrim(p_payload->>'description'), ''),
      'GENERAL', 'ACTIVE', v_employee_id, v_employee_id
    ) returning id into v_template_id;

    insert into public.phase_template_versions(
      template_id, version_number, status,
      created_by_employee_id, updated_by_employee_id
    ) values (
      v_template_id, 1, 'DRAFT', v_employee_id, v_employee_id
    ) returning id into v_version_id;

    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, after_data)
    values (v_template_id, v_version_id, v_employee_id, 'DRAFT_CREATED', jsonb_build_object('name', btrim(p_payload->>'name'), 'versionNumber', 1));

  elsif v_action = 'UPDATE_DRAFT' then
    select version.template_id into v_template_id
    from public.phase_template_versions version
    where version.id = v_version_id and version.status = 'DRAFT'
    for update;
    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'draft_not_found', 'message', 'Không tìm thấy bản nháp có thể sửa.');
    end if;
    if jsonb_typeof(coalesce(p_payload->'stages', '[]'::jsonb)) <> 'array' then
      return jsonb_build_object('success', false, 'code', 'stages_invalid', 'message', 'Danh sách giai đoạn không hợp lệ.');
    end if;

    select jsonb_build_object('name', template.name, 'description', template.description)
      into v_before
    from public.phase_templates template where template.id = v_template_id for update;

    update public.phase_templates
    set name = coalesce(nullif(btrim(p_payload->>'name'), ''), name),
        description = case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'), '') else description end,
        updated_by_employee_id = v_employee_id,
        updated_at = now()
    where id = v_template_id;

    delete from public.phase_template_tasks task
    using public.phase_template_stages stage
    where task.stage_id = stage.id and stage.version_id = v_version_id;
    delete from public.phase_template_stages where version_id = v_version_id;

    v_stage_order := 0;
    for v_stage in select * from jsonb_array_elements(coalesce(p_payload->'stages', '[]'::jsonb)) loop
      v_stage_order := v_stage_order + 1;
      if coalesce((v_stage->>'orderIndex')::integer, v_stage_order) <> v_stage_order then
        raise exception 'phase_template_stage_order_invalid' using errcode = 'P0001';
      end if;
      if nullif(btrim(v_stage->>'name'), '') is null then
        raise exception 'phase_template_stage_name_required' using errcode = 'P0001';
      end if;
      if jsonb_typeof(coalesce(v_stage->'tasks', '[]'::jsonb)) <> 'array' then
        raise exception 'phase_template_tasks_invalid' using errcode = 'P0001';
      end if;

      insert into public.phase_template_stages(
        version_id, name, order_index, start_offset_days,
        duration_days, requires_review
      ) values (
        v_version_id, btrim(v_stage->>'name'), v_stage_order,
        nullif(v_stage->>'startOffsetDays', '')::integer,
        nullif(v_stage->>'durationDays', '')::integer,
        coalesce((v_stage->>'requiresReview')::boolean, false)
      ) returning id into v_stage_id;

      v_task_order := 0;
      for v_task in select * from jsonb_array_elements(coalesce(v_stage->'tasks', '[]'::jsonb)) loop
        v_task_order := v_task_order + 1;
        if coalesce((v_task->>'orderIndex')::integer, v_task_order) <> v_task_order then
          raise exception 'phase_template_task_order_invalid' using errcode = 'P0001';
        end if;
        if nullif(btrim(v_task->>'name'), '') is null then
          raise exception 'phase_template_task_name_required' using errcode = 'P0001';
        end if;
        insert into public.phase_template_tasks(
          stage_id, name, description, order_index, start_offset_days,
          is_required, requires_review, assignee_role_code
        ) values (
          v_stage_id, btrim(v_task->>'name'), nullif(btrim(v_task->>'description'), ''),
          v_task_order, nullif(v_task->>'startOffsetDays', '')::integer,
          coalesce((v_task->>'isRequired')::boolean, true),
          coalesce((v_task->>'requiresReview')::boolean, false),
          nullif(upper(btrim(v_task->>'assigneeRoleCode')), '')
        );
      end loop;
    end loop;

    perform public.phase_template_validate_draft(v_version_id);
    update public.phase_template_versions
    set updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_version_id;
    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, before_data, after_data)
    values (v_template_id, v_version_id, v_employee_id, 'DRAFT_UPDATED', v_before, jsonb_build_object('stageCount', v_stage_order));

  elsif v_action = 'CLONE_VERSION' then
    select version.template_id into v_template_id
    from public.phase_template_versions version
    where version.id = v_source_version_id
    for update;
    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'source_version_not_found', 'message', 'Không tìm thấy phiên bản nguồn.');
    end if;
    if exists (select 1 from public.phase_template_versions version where version.template_id = v_template_id and version.status = 'DRAFT') then
      return jsonb_build_object('success', false, 'code', 'draft_already_exists', 'message', 'Mẫu đang có một bản nháp.');
    end if;
    select max(version.version_number) + 1 into v_new_version_number
    from public.phase_template_versions version where version.template_id = v_template_id;

    insert into public.phase_template_versions(
      template_id, version_number, status, source_version_id,
      created_by_employee_id, updated_by_employee_id
    ) values (
      v_template_id, v_new_version_number, 'DRAFT', v_source_version_id,
      v_employee_id, v_employee_id
    ) returning id into v_version_id;

    for v_stage in
      select to_jsonb(stage) from public.phase_template_stages stage
      where stage.version_id = v_source_version_id order by stage.order_index
    loop
      insert into public.phase_template_stages(version_id, name, order_index, start_offset_days, duration_days, requires_review)
      values (v_version_id, v_stage->>'name', (v_stage->>'order_index')::integer,
        nullif(v_stage->>'start_offset_days', '')::integer,
        nullif(v_stage->>'duration_days', '')::integer,
        (v_stage->>'requires_review')::boolean)
      returning id into v_stage_id;

      insert into public.phase_template_tasks(stage_id, name, description, order_index, start_offset_days, is_required, requires_review, assignee_role_code)
      select v_stage_id, task.name, task.description, task.order_index, task.start_offset_days,
        task.is_required, task.requires_review, task.assignee_role_code
      from public.phase_template_tasks task
      where task.stage_id = (v_stage->>'id')::bigint
      order by task.order_index;
    end loop;

    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, after_data)
    values (v_template_id, v_version_id, v_employee_id, 'VERSION_CLONED', jsonb_build_object('sourceVersionId', v_source_version_id, 'versionNumber', v_new_version_number));

  elsif v_action = 'PUBLISH' then
    select version.template_id into v_template_id
    from public.phase_template_versions version
    where version.id = v_version_id and version.status = 'DRAFT'
    for update;
    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'draft_not_found', 'message', 'Không tìm thấy bản nháp có thể xuất bản.');
    end if;
    perform public.phase_template_validate_draft(v_version_id);
    select template.current_version_id into v_current_version_id
    from public.phase_templates template where template.id = v_template_id for update;
    update public.phase_templates set current_version_id = null where id = v_template_id;
    if v_current_version_id is not null and v_current_version_id <> v_version_id then
      update public.phase_template_versions
      set status = 'ARCHIVED', archived_at = now(), updated_by_employee_id = v_employee_id, updated_at = now()
      where id = v_current_version_id and status = 'PUBLISHED';
    end if;
    update public.phase_template_versions
    set status = 'PUBLISHED', published_at = now(), archived_at = null,
        updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_version_id;
    update public.phase_templates
    set status = 'ACTIVE', current_version_id = v_version_id,
        updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_template_id;
    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, reason, after_data)
    values (v_template_id, v_version_id, v_employee_id, 'PUBLISHED', v_reason, jsonb_build_object('previousVersionId', v_current_version_id));

  elsif v_action = 'ARCHIVE' then
    select template.id, template.current_version_id into v_template_id, v_version_id
    from public.phase_templates template
    where template.id = v_template_id and template.status = 'ACTIVE'
    for update;
    if v_template_id is null or v_version_id is null then
      return jsonb_build_object('success', false, 'code', 'published_template_not_found', 'message', 'Không tìm thấy mẫu đang hoạt động.');
    end if;
    update public.phase_templates
    set current_version_id = null, status = 'ARCHIVED', updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_template_id;
    update public.phase_template_versions
    set status = 'ARCHIVED', archived_at = now(), updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_version_id and status = 'PUBLISHED';
    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, reason)
    values (v_template_id, v_version_id, v_employee_id, 'ARCHIVED', v_reason);

  elsif v_action = 'RESTORE' then
    select version.template_id into v_template_id
    from public.phase_template_versions version
    join public.phase_templates template on template.id = version.template_id
    where version.id = v_version_id and version.status = 'ARCHIVED' and template.status = 'ARCHIVED'
    for update of version, template;
    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'archived_version_not_found', 'message', 'Không tìm thấy phiên bản lưu trữ.');
    end if;
    if exists (select 1 from public.phase_template_versions version where version.template_id = v_template_id and version.status = 'PUBLISHED') then
      return jsonb_build_object('success', false, 'code', 'published_version_exists', 'message', 'Mẫu đã có một phiên bản đang xuất bản.');
    end if;
    update public.phase_template_versions
    set status = 'PUBLISHED', archived_at = null, updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_version_id;
    update public.phase_templates
    set status = 'ACTIVE', current_version_id = v_version_id, updated_by_employee_id = v_employee_id, updated_at = now()
    where id = v_template_id;
    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, reason)
    values (v_template_id, v_version_id, v_employee_id, 'RESTORED', v_reason);

  elsif v_action = 'DELETE_DRAFT' then
    select version.template_id, jsonb_build_object('versionNumber', version.version_number, 'sourceVersionId', version.source_version_id)
      into v_template_id, v_before
    from public.phase_template_versions version
    where version.id = v_version_id and version.status = 'DRAFT'
    for update;
    if v_template_id is null then
      return jsonb_build_object('success', false, 'code', 'draft_not_found', 'message', 'Không tìm thấy bản nháp có thể xóa.');
    end if;
    if exists (select 1 from public.phase_template_applications application where application.version_id = v_version_id)
      or exists (select 1 from public.phase_template_versions version where version.source_version_id = v_version_id) then
      return jsonb_build_object('success', false, 'code', 'draft_in_use', 'message', 'Bản nháp đang được tham chiếu và không thể xóa.');
    end if;
    delete from public.phase_template_tasks task
    using public.phase_template_stages stage
    where task.stage_id = stage.id and stage.version_id = v_version_id;
    delete from public.phase_template_stages where version_id = v_version_id;
    delete from public.phase_template_versions where id = v_version_id;
    insert into public.phase_template_audit(template_id, version_id, actor_employee_id, action, reason, before_data)
    values (v_template_id, null, v_employee_id, 'DRAFT_DELETED', v_reason, v_before);
    v_version_id := null;
  end if;

  return jsonb_build_object('success', true, 'action', v_action, 'templateId', v_template_id, 'versionId', v_version_id);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'code', 'template_conflict', 'message', 'Tên mẫu, phiên bản hoặc bản nháp đã tồn tại.');
  when check_violation or foreign_key_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu mẫu không hợp lệ.');
  when others then
    return jsonb_build_object('success', false, 'code', 'phase_template_mutation_failed', 'message', 'Không thể cập nhật mẫu giai đoạn.');
end;
$$;

revoke all on function public.phase_template_validate_draft(bigint) from public, anon, authenticated;
revoke all on function public.manage_phase_template_atomic(jsonb) from public, anon;
grant execute on function public.manage_phase_template_atomic(jsonb) to authenticated, service_role;

comment on function public.manage_phase_template_atomic(jsonb) is
  'Authorized atomic Phase Template draft/version lifecycle management.';

commit;
