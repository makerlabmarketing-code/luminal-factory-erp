-- Restores the exact create RPC behavior shipped by
-- 20260722110928_corrective_slice_6_production_order_persistence.sql.
-- REVIEW BEFORE USE. This file is not executed by the application.

begin;

create or replace function public.create_production_order_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_employee_id bigint;
  v_project_id bigint;
  v_order_id uuid;
  v_production_code text;
  v_stage jsonb;
  v_stage_id uuid;
  v_stage_map jsonb := '{}'::jsonb;
  v_member jsonb;
  v_member_employee_id bigint;
  v_project_member_id bigint;
  v_task jsonb;
  v_task_id bigint;
  v_stage_key text;
  v_status text;
begin
  if v_actor is null then return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.'); end if;

  select e.id into v_employee_id
  from public.employees e
  where e.auth_user_id = v_actor and coalesce(e.is_active, true) = true and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
  limit 1;

  if v_employee_id is null then return jsonb_build_object('success', false, 'code', 'actor_not_allowed', 'message', 'Không thể xác định nhân sự thao tác.'); end if;
  if not (public.has_workspace_access('ADMIN_WORKSPACE') and public.has_permission('PROJECT_MANAGE') and public.has_permission('TASK_MANAGE')) then
    return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền tạo lệnh sản xuất.');
  end if;
  if p_payload ? 'createdByEmployeeId' or p_payload ? 'created_by_employee_id' then
    return jsonb_build_object('success', false, 'code', 'client_actor_rejected', 'message', 'Dữ liệu người thao tác không hợp lệ.');
  end if;

  v_project_id := nullif(p_payload->>'projectId','')::bigint;
  if v_project_id is null or not public.can_view_project(v_project_id) then
    return jsonb_build_object('success', false, 'code', 'project_not_allowed', 'message', 'Dự án không hợp lệ hoặc bạn không có quyền truy cập.');
  end if;

  v_production_code := upper(nullif(btrim(coalesce(p_payload->>'productionCode', p_payload->>'production_code')), ''));
  if v_production_code is null then return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Vui lòng nhập mã sản xuất.'); end if;

  insert into public.production_orders(
    production_code, display_name, project_id, product_or_collection, colorway, planned_quantity,
    completed_quantity, priority, status, target_completion_date, workflow_template_id,
    workflow_template_version, source_production_order_id, project_manager_employee_id,
    creative_lead_employee_id, created_by_employee_id, material_requirements
  ) values (
    v_production_code,
    nullif(btrim(p_payload->>'displayName'), ''),
    v_project_id,
    nullif(btrim(coalesce(p_payload->>'productOrCollection', p_payload->>'product_or_collection')), ''),
    nullif(btrim(p_payload->>'colorway'), ''),
    (p_payload->>'plannedQuantity')::integer,
    coalesce(nullif(p_payload->>'completedQuantity','')::integer, 0),
    coalesce(nullif(p_payload->>'priority',''), 'NORMAL'),
    coalesce(nullif(p_payload->>'status',''), 'NOT_STARTED'),
    nullif(p_payload->>'targetCompletionDate','')::date,
    nullif(p_payload->>'workflowTemplateId','')::uuid,
    nullif(p_payload->>'workflowTemplateVersion','')::integer,
    nullif(p_payload->>'sourceProductionOrderId','')::uuid,
    (p_payload->>'projectManagerEmployeeId')::bigint,
    (p_payload->>'creativeLeadEmployeeId')::bigint,
    v_employee_id,
    coalesce(p_payload->'materialRequirements', '[]'::jsonb)
  ) returning id into v_order_id;

  for v_member in select * from jsonb_array_elements(coalesce(p_payload->'members','[]'::jsonb)) loop
    v_member_employee_id := (v_member->>'employeeId')::bigint;
    select pm.id into v_project_member_id from public.project_members pm join public.employees e on e.id = pm.employee_id
    where pm.project_id = v_project_id and pm.employee_id = v_member_employee_id and pm.status = 'ACTIVE' and coalesce(e.is_active,true) = true and coalesce(e.status,'ACTIVE') = 'ACTIVE' limit 1;
    if v_project_member_id is null then raise exception 'invalid production member'; end if;
    insert into public.production_order_members(production_order_id, project_member_id, employee_id, production_role, is_active)
    values (v_order_id, v_project_member_id, v_member_employee_id, coalesce(v_member->>'role', 'MEMBER'), coalesce((v_member->>'active')::boolean, true));
  end loop;

  if not exists (select 1 from public.production_order_members where production_order_id = v_order_id and employee_id = (p_payload->>'projectManagerEmployeeId')::bigint and is_active) then raise exception 'manager must be an active production member'; end if;
  if not exists (select 1 from public.production_order_members where production_order_id = v_order_id and employee_id = (p_payload->>'creativeLeadEmployeeId')::bigint and is_active) then raise exception 'creative lead must be an active production member'; end if;

  for v_stage in select * from jsonb_array_elements(coalesce(p_payload->'stages','[]'::jsonb)) loop
    v_stage_key := nullif(btrim(coalesce(v_stage->>'stageKey', v_stage->>'id')), '');
    v_status := coalesce(nullif(v_stage->>'status',''), case when coalesce((v_stage->>'sequence')::integer, 1) = 1 then 'READY' else 'LOCKED' end);
    insert into public.phases(project_id, name, order_index, status)
    values (v_project_id, nullif(btrim(v_stage->>'name'), ''), (v_stage->>'sequence')::integer, case when v_status = 'LOCKED' then 'TODO' else 'READY' end)
    returning id into v_project_member_id;
    insert into public.production_stages(production_order_id, project_id, phase_id, template_stage_id, stage_key, name, sequence, status, owner_employee_id, deadline, progress, requires_review)
    values (v_order_id, v_project_id, v_project_member_id, nullif(v_stage->>'templateStageId','')::uuid, v_stage_key, nullif(btrim(v_stage->>'name'), ''), (v_stage->>'sequence')::integer, v_status, nullif(v_stage->>'ownerEmployeeId','')::bigint, nullif(v_stage->>'deadline','')::date, coalesce(nullif(v_stage->>'progress','')::integer, 0), coalesce((v_stage->>'requiresReview')::boolean, false))
    returning id into v_stage_id;
    v_stage_map := v_stage_map || jsonb_build_object(v_stage_key, v_stage_id);
  end loop;

  update public.production_orders set current_stage_id = (select id from public.production_stages where production_order_id = v_order_id order by sequence limit 1) where id = v_order_id;

  for v_stage in select * from jsonb_array_elements(coalesce(p_payload->'stages','[]'::jsonb)) loop
    v_stage_key := nullif(btrim(coalesce(v_stage->>'stageKey', v_stage->>'id')), '');
    v_stage_id := (v_stage_map->>v_stage_key)::uuid;
    if coalesce((v_stage->>'sequence')::integer, 1) > 1 then
      insert into public.production_stage_dependencies(production_order_id, stage_id, depends_on_stage_id)
      values (v_order_id, v_stage_id, (select id from public.production_stages where production_order_id = v_order_id and sequence = (v_stage->>'sequence')::integer - 1));
    end if;
    for v_task in select * from jsonb_array_elements(coalesce(v_stage->'tasks','[]'::jsonb)) loop
      if nullif(v_task->>'assigneeEmployeeId','') is not null and not exists (
        select 1 from public.production_order_members pom
        join public.employees e on e.id = pom.employee_id
        where pom.production_order_id = v_order_id
          and pom.employee_id = (v_task->>'assigneeEmployeeId')::bigint
          and pom.is_active
          and coalesce(e.is_active,true) = true
          and coalesce(e.status,'ACTIVE') = 'ACTIVE'
      ) then
        raise exception 'invalid task assignee';
      end if;
      insert into public.tasks(project_id, phase_id, title, description, assignee_employee_id, deadline, status, created_by_employee_id, updated_by_employee_id)
      values (v_project_id, (select phase_id from public.production_stages where id = v_stage_id), nullif(btrim(v_task->>'title'), ''), nullif(v_task->>'description',''), nullif(v_task->>'assigneeEmployeeId','')::bigint, nullif(v_task->>'deadline','')::timestamptz, coalesce(nullif(v_task->>'status',''), 'BACKLOG'), v_employee_id, v_employee_id)
      returning id into v_task_id;
      insert into public.project_activity(project_id, task_id, production_order_id, production_stage_id, actor_employee_id, activity_type, payload)
      values (v_project_id, v_task_id, v_order_id, v_stage_id, v_employee_id, 'TASK_CREATED', jsonb_build_object('productionCode', v_production_code));
    end loop;
  end loop;

  insert into public.project_activity(project_id, production_order_id, actor_employee_id, activity_type, payload)
  values (v_project_id, v_order_id, v_employee_id, 'PRODUCTION_ORDER_CREATED', jsonb_build_object('productionCode', v_production_code));

  return jsonb_build_object('success', true, 'productionOrderId', v_order_id, 'productionCode', v_production_code);
exception
  when unique_violation then return jsonb_build_object('success', false, 'code', 'duplicate_production_code', 'message', 'Mã sản xuất đã tồn tại.');
  when invalid_text_representation or datetime_field_overflow or check_violation or not_null_violation then return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu lệnh sản xuất chưa hợp lệ.');
  when others then return jsonb_build_object('success', false, 'code', 'production_order_create_failed', 'message', 'Không thể tạo lệnh sản xuất đầy đủ.');
end;
$$;

revoke all on function public.create_production_order_atomic(jsonb) from public, anon;
grant execute on function public.create_production_order_atomic(jsonb) to authenticated;

commit;
