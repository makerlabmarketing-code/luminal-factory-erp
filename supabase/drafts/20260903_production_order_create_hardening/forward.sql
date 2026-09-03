-- DRAFT ONLY. Do not execute until the migration and runtime activation are approved.
-- Replaces only public.create_production_order_atomic(jsonb).

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
  v_display_name text;
  v_product text;
  v_colorway text;
  v_planned_quantity integer;
  v_priority text;
  v_target_date date;
  v_manager_id bigint;
  v_creative_lead_id bigint;
  v_stage jsonb;
  v_stage_id uuid;
  v_stage_map jsonb := '{}'::jsonb;
  v_member jsonb;
  v_member_employee_id bigint;
  v_project_member_id bigint;
  v_task jsonb;
  v_task_id bigint;
  v_stage_key text;
  v_expected_stages constant jsonb := '[
    {"stageKey":"concept","name":"Ý tưởng","sequence":1,"requiresReview":true,"tasks":[{"title":"Chốt câu chuyện màu"}]},
    {"stageKey":"sculpt","name":"Dựng mẫu 3D","sequence":2,"requiresReview":true,"tasks":[{"title":"Hoàn tất file sculpt"}]},
    {"stageKey":"color","name":"Lên màu","sequence":3,"requiresReview":true,"tasks":[{"title":"Chốt công thức màu"}]},
    {"stageKey":"support-print","name":"Support và thiết lập in","sequence":4,"requiresReview":false,"tasks":[{"title":"File in sẵn sàng"}]},
    {"stageKey":"test-print","name":"In thử","sequence":5,"requiresReview":true,"tasks":[{"title":"Mẫu in thử đạt yêu cầu"}]},
    {"stageKey":"master-finish","name":"Hoàn thiện master","sequence":6,"requiresReview":true,"tasks":[{"title":"Master sạch lỗi"}]},
    {"stageKey":"mold","name":"Làm khuôn","sequence":7,"requiresReview":true,"tasks":[{"title":"Khuôn đạt kiểm tra"}]},
    {"stageKey":"casting","name":"Đúc resin","sequence":8,"requiresReview":false,"tasks":[{"title":"Đúc đủ số lượng kế hoạch"}]},
    {"stageKey":"finishing-qc","name":"Hoàn thiện và QC","sequence":9,"requiresReview":true,"tasks":[{"title":"QC đạt"}]},
    {"stageKey":"content","name":"Ảnh và nội dung","sequence":10,"requiresReview":true,"tasks":[{"title":"Ảnh và nội dung sẵn sàng"}]},
    {"stageKey":"packaging","name":"Đóng gói","sequence":11,"requiresReview":false,"tasks":[{"title":"Đủ vật tư đóng gói"}]},
    {"stageKey":"shipping-prep","name":"Chuẩn bị giao hàng","sequence":12,"requiresReview":false,"tasks":[{"title":"Danh sách giao hàng sẵn sàng"}]}
  ]'::jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.');
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu lệnh sản xuất chưa hợp lệ.');
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) key
    where key not in (
      'productionCode', 'displayName', 'projectId', 'productOrCollection', 'colorway',
      'plannedQuantity', 'targetCompletionDate', 'priority', 'projectManagerEmployeeId',
      'creativeLeadEmployeeId', 'members', 'stages'
    )
  ) then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu lệnh sản xuất có trường không được hỗ trợ.');
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.auth_user_id = v_actor
    and coalesce(e.is_active, true) = true
    and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
  limit 1;
  if v_employee_id is null then
    return jsonb_build_object('success', false, 'code', 'actor_not_allowed', 'message', 'Không thể xác định nhân sự thao tác.');
  end if;
  if not (
    public.has_workspace_access('ADMIN_WORKSPACE')
    and public.has_permission('PROJECT_MANAGE')
    and public.has_permission('TASK_MANAGE')
  ) then
    return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền tạo lệnh sản xuất.');
  end if;

  v_project_id := nullif(p_payload->>'projectId', '')::bigint;
  if v_project_id is null or not public.can_view_project(v_project_id) then
    return jsonb_build_object('success', false, 'code', 'project_not_allowed', 'message', 'Dự án không hợp lệ hoặc bạn không có quyền truy cập.');
  end if;
  if exists (select 1 from public.projects p where p.id = v_project_id and upper(coalesce(p.status, '')) in ('ARCHIVED', 'CANCELLED', 'COMPLETED')) then
    return jsonb_build_object('success', false, 'code', 'project_not_allowed', 'message', 'Dự án đã đóng, không thể tạo lệnh sản xuất.');
  end if;

  v_production_code := upper(nullif(btrim(p_payload->>'productionCode'), ''));
  v_display_name := nullif(btrim(coalesce(p_payload->>'displayName', '')), '');
  v_product := nullif(btrim(p_payload->>'productOrCollection'), '');
  v_colorway := nullif(btrim(p_payload->>'colorway'), '');
  v_planned_quantity := nullif(p_payload->>'plannedQuantity', '')::integer;
  v_priority := coalesce(nullif(p_payload->>'priority', ''), 'NORMAL');
  v_target_date := nullif(p_payload->>'targetCompletionDate', '')::date;
  v_manager_id := nullif(p_payload->>'projectManagerEmployeeId', '')::bigint;
  v_creative_lead_id := nullif(p_payload->>'creativeLeadEmployeeId', '')::bigint;

  if v_production_code is null or v_production_code !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
    or v_product is null or length(v_product) > 160
    or v_colorway is null or length(v_colorway) > 120
    or length(coalesce(v_display_name, '')) > 160
    or v_planned_quantity is null or v_planned_quantity < 1 or v_planned_quantity > 1000000
    or v_priority not in ('LOW', 'NORMAL', 'HIGH', 'URGENT')
    or v_target_date is null or v_target_date < current_date
    or v_manager_id is null or v_creative_lead_id is null
  then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu lệnh sản xuất chưa hợp lệ.');
  end if;

  if not exists (
    select 1 from public.project_members pm join public.employees e on e.id = pm.employee_id
    where pm.project_id = v_project_id and pm.employee_id = v_manager_id
      and pm.role_code = 'PROJECT_MANAGER' and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
  ) then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Quản lý dự án không còn hợp lệ.');
  end if;
  if not exists (
    select 1 from public.project_members pm join public.employees e on e.id = pm.employee_id
    where pm.project_id = v_project_id and pm.employee_id = v_creative_lead_id
      and pm.role_code = 'CREATIVE_LEAD' and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
  ) then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Creative lead không còn hợp lệ.');
  end if;

  if jsonb_typeof(p_payload->'members') <> 'array'
    or jsonb_array_length(p_payload->'members') < 2
    or jsonb_typeof(p_payload->'stages') <> 'array'
    or p_payload->'stages' <> v_expected_stages
  then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Quy trình hoặc thành viên sản xuất chưa hợp lệ.');
  end if;
  if (select count(*) from jsonb_array_elements(p_payload->'members')) <>
     (select count(distinct (member->>'employeeId')::bigint) from jsonb_array_elements(p_payload->'members') member)
  then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Thành viên sản xuất bị trùng.');
  end if;

  insert into public.production_orders(
    production_code, display_name, project_id, product_or_collection, colorway, planned_quantity,
    completed_quantity, priority, status, target_completion_date, workflow_template_id,
    workflow_template_version, source_production_order_id, project_manager_employee_id,
    creative_lead_employee_id, created_by_employee_id, material_requirements
  ) values (
    v_production_code, v_display_name, v_project_id, v_product, v_colorway, v_planned_quantity,
    0, v_priority, 'NOT_STARTED', v_target_date, null, null, null, v_manager_id,
    v_creative_lead_id, v_employee_id, '[]'::jsonb
  ) returning id into v_order_id;

  for v_member in select value from jsonb_array_elements(p_payload->'members') loop
    if jsonb_typeof(v_member) <> 'object'
      or exists (select 1 from jsonb_object_keys(v_member) key where key not in ('employeeId', 'role', 'active'))
      or coalesce((v_member->>'active')::boolean, false) is not true
      or v_member->>'role' not in ('PROJECT_MANAGER', 'CREATIVE_LEAD', 'MEMBER')
    then
      raise exception using errcode = '22023', message = 'invalid production member payload';
    end if;
    v_member_employee_id := nullif(v_member->>'employeeId', '')::bigint;
    select pm.id into v_project_member_id
    from public.project_members pm join public.employees e on e.id = pm.employee_id
    where pm.project_id = v_project_id and pm.employee_id = v_member_employee_id and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) and coalesce(e.status, 'ACTIVE') = 'ACTIVE'
    limit 1;
    if v_project_member_id is null
      or (v_member_employee_id = v_manager_id and v_member->>'role' <> 'PROJECT_MANAGER')
      or (v_member_employee_id = v_creative_lead_id and v_member->>'role' <> 'CREATIVE_LEAD')
      or (v_member_employee_id not in (v_manager_id, v_creative_lead_id) and v_member->>'role' <> 'MEMBER')
    then
      raise exception using errcode = '22023', message = 'invalid production member';
    end if;
    insert into public.production_order_members(production_order_id, project_member_id, employee_id, production_role, is_active)
    values (v_order_id, v_project_member_id, v_member_employee_id, v_member->>'role', true);
  end loop;

  if not exists (select 1 from public.production_order_members where production_order_id = v_order_id and employee_id = v_manager_id and production_role = 'PROJECT_MANAGER' and is_active)
    or not exists (select 1 from public.production_order_members where production_order_id = v_order_id and employee_id = v_creative_lead_id and production_role = 'CREATIVE_LEAD' and is_active)
  then
    raise exception using errcode = '22023', message = 'required production roles missing';
  end if;

  for v_stage in select value from jsonb_array_elements(v_expected_stages) loop
    v_stage_key := v_stage->>'stageKey';
    insert into public.phases(project_id, name, order_index, status)
    values (v_project_id, v_stage->>'name', (v_stage->>'sequence')::integer, case when (v_stage->>'sequence')::integer = 1 then 'READY' else 'TODO' end)
    returning id into v_project_member_id;
    insert into public.production_stages(
      production_order_id, project_id, phase_id, stage_key, name, sequence, status, progress, requires_review
    ) values (
      v_order_id, v_project_id, v_project_member_id, v_stage_key, v_stage->>'name',
      (v_stage->>'sequence')::integer,
      case when (v_stage->>'sequence')::integer = 1 then 'READY' else 'LOCKED' end,
      0, (v_stage->>'requiresReview')::boolean
    ) returning id into v_stage_id;
    v_stage_map := v_stage_map || jsonb_build_object(v_stage_key, v_stage_id);
  end loop;

  update public.production_orders
  set current_stage_id = (select id from public.production_stages where production_order_id = v_order_id order by sequence limit 1)
  where id = v_order_id;

  for v_stage in select value from jsonb_array_elements(v_expected_stages) loop
    v_stage_key := v_stage->>'stageKey';
    v_stage_id := (v_stage_map->>v_stage_key)::uuid;
    if (v_stage->>'sequence')::integer > 1 then
      insert into public.production_stage_dependencies(production_order_id, stage_id, depends_on_stage_id)
      values (
        v_order_id,
        v_stage_id,
        (select id from public.production_stages where production_order_id = v_order_id and sequence = (v_stage->>'sequence')::integer - 1)
      );
    end if;
    for v_task in select value from jsonb_array_elements(v_stage->'tasks') loop
      insert into public.tasks(project_id, phase_id, title, status, created_by_employee_id, updated_by_employee_id)
      values (
        v_project_id,
        (select phase_id from public.production_stages where id = v_stage_id),
        v_task->>'title',
        case when (v_stage->>'sequence')::integer = 1 then 'READY' else 'BACKLOG' end,
        v_employee_id,
        v_employee_id
      ) returning id into v_task_id;
      insert into public.project_activity(project_id, task_id, production_order_id, production_stage_id, actor_employee_id, activity_type, payload)
      values (v_project_id, v_task_id, v_order_id, v_stage_id, v_employee_id, 'TASK_CREATED', jsonb_build_object('productionCode', v_production_code));
    end loop;
  end loop;

  insert into public.project_activity(project_id, production_order_id, actor_employee_id, activity_type, payload)
  values (v_project_id, v_order_id, v_employee_id, 'PRODUCTION_ORDER_CREATED', jsonb_build_object('productionCode', v_production_code));

  return jsonb_build_object('success', true, 'productionOrderId', v_order_id, 'productionCode', v_production_code);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'code', 'duplicate_production_code', 'message', 'Mã sản xuất đã tồn tại.');
  when invalid_text_representation or invalid_parameter_value or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation then
    return jsonb_build_object('success', false, 'code', 'payload_validation_failed', 'message', 'Dữ liệu lệnh sản xuất chưa hợp lệ.');
  when others then
    return jsonb_build_object('success', false, 'code', 'production_order_create_failed', 'message', 'Không thể tạo lệnh sản xuất đầy đủ.');
end;
$$;

revoke all on function public.create_production_order_atomic(jsonb) from public, anon;
grant execute on function public.create_production_order_atomic(jsonb) to authenticated;

commit;
