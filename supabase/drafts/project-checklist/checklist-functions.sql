-- REVIEW ONLY. Applied with the guarded create-project replacement in forward.sql.
create or replace function public.update_staff_checklist_task(
  p_task_id bigint, p_employee_id bigint, p_expected_status text, p_next_status text,
  p_note text default null, p_deadline timestamptz default null, p_change_deadline boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_task public.tasks%rowtype; v_status text; v_allowed text[];
begin
  select * into v_task from public.tasks where id=p_task_id and assignee_employee_id=p_employee_id for update;
  if not found or v_task.project_id is null or not exists (
    select 1 from public.employees e join public.project_members m on m.employee_id=e.id
    join public.projects p on p.id=m.project_id
    where e.id=p_employee_id and coalesce(e.is_active,true) and coalesce(e.status,'ACTIVE')='ACTIVE'
      and m.project_id=v_task.project_id and m.status='ACTIVE' and coalesce(p.status,'') not in ('CANCELLED','ARCHIVED')
  ) then return jsonb_build_object('success',false,'message','Không thể cập nhật công việc được giao.'); end if;
  v_status := coalesce(v_task.status,'READY');
  if p_expected_status is null or v_status<>p_expected_status then return jsonb_build_object('success',false,'code','stale_task','message','Công việc vừa thay đổi. Hãy tải lại.'); end if;
  v_allowed := case v_status
    when 'BACKLOG' then array['READY'] when 'READY' then array['IN_PROGRESS']
    when 'IN_PROGRESS' then array['PENDING_REVIEW','BLOCKED']
    when 'REVISION_REQUIRED' then array['IN_PROGRESS'] when 'BLOCKED' then array['IN_PROGRESS']
    when 'ON_HOLD' then array['READY'] when 'APPROVED' then array['COMPLETED'] else array[]::text[] end;
  if p_next_status is null or (p_next_status<>v_status and not p_next_status=any(v_allowed)) then
    return jsonb_build_object('success',false,'message','Chuyển trạng thái công việc không hợp lệ.');
  end if;
  if p_next_status in ('COMPLETED','CANCELLED') and p_next_status=v_status then
    return jsonb_build_object('success',false,'message','Công việc đã đóng. Liên hệ quản lý để điều chỉnh.');
  end if;
  if p_next_status='BLOCKED' and nullif(btrim(p_note),'') is null then
    return jsonb_build_object('success',false,'message','Vui lòng ghi ngắn gọn bạn đang vướng gì.');
  end if;
  if p_change_deadline and p_deadline is not null and exists (
    select 1 from public.projects where id=v_task.project_id and project_deadline is not null and (p_deadline at time zone 'Asia/Bangkok')::date>project_deadline
  ) then return jsonb_build_object('success',false,'message','Hạn công việc không được sau hạn dự án.'); end if;
  update public.tasks set status=p_next_status,
    deadline=case when p_change_deadline then p_deadline else deadline end,
    completed_at=case when p_next_status='COMPLETED' then now() else completed_at end,
    updated_by_employee_id=p_employee_id,updated_at=now() where id=v_task.id;
  if nullif(btrim(p_note),'') is not null then
    insert into public.task_comments(project_id,task_id,employee_id,body) values(v_task.project_id,v_task.id,p_employee_id,btrim(p_note));
  end if;
  if v_status<>p_next_status then
    insert into public.project_activity(project_id,task_id,actor_employee_id,activity_type,payload)
    values(v_task.project_id,v_task.id,p_employee_id,'STATUS_CHANGED',jsonb_build_object('oldStatus',v_status,'newStatus',p_next_status));
  end if;
  return jsonb_build_object('success',true,'status',p_next_status,'deadline',case when p_change_deadline then p_deadline else v_task.deadline end);
end; $$;
revoke all on function public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean) to service_role;

create or replace function public.save_project_template_atomic(p_project_id bigint,p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor bigint; v_result jsonb; v_version bigint; v_stages jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('success',false,'message','Phiên đăng nhập không hợp lệ.'); end if;
  select id into v_actor from public.employees where auth_user_id=auth.uid() and coalesce(is_active,true) and coalesce(status,'ACTIVE')='ACTIVE' limit 1;
  if v_actor is null or not coalesce(public.has_workspace_access('ADMIN_WORKSPACE'),false) or not coalesce(public.has_permission('PHASE_TEMPLATE_MANAGE'),false) then
    return jsonb_build_object('success',false,'message','Bạn không có quyền lưu mẫu dự án.');
  end if;
  if not coalesce(public.has_permission('PROJECT_MANAGE'),false) and not exists (
    select 1 from public.project_members where project_id=p_project_id and employee_id=v_actor and status='ACTIVE'
  ) then return jsonb_build_object('success',false,'message','Bạn không có quyền xem dự án này.'); end if;
  perform 1 from public.projects where id=p_project_id for update;
  if not found or nullif(btrim(p_name),'') is null or length(btrim(p_name))>160 then
    return jsonb_build_object('success',false,'message','Dự án hoặc tên mẫu không hợp lệ.');
  end if;
  perform 1 from public.phases where project_id=p_project_id order by id for share;
  perform 1 from public.tasks where project_id=p_project_id order by id for share;
  if exists(select 1 from public.tasks where project_id=p_project_id and phase_id is null) then
    return jsonb_build_object('success',false,'message','Hãy xếp các công việc vào giai đoạn trước khi lưu mẫu.');
  end if;
  select jsonb_agg(jsonb_build_object('name',p.name,'orderIndex',p.position,'requiresReview',coalesce(p.required_review,false),
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('name',t.title,'orderIndex',t.position,'isRequired',coalesce(t.is_required,true),
      'requiresReview',coalesce(t.requires_review,false),'assigneeRoleCode','PROJECT_MANAGER') order by t.position)
      from (select title,is_required,requires_review,row_number() over(order by id) as position from public.tasks where project_id=p_project_id and phase_id=p.id) t),'[]'::jsonb)) order by p.position)
  into v_stages from (select id,name,required_review,row_number() over(order by order_index,id) as position from public.phases where project_id=p_project_id) p;
  if v_stages is null then return jsonb_build_object('success',false,'message','Dự án cần có ít nhất một giai đoạn để làm mẫu.'); end if;
  v_result := public.manage_phase_template_atomic(jsonb_build_object('action','CREATE_DRAFT','name',btrim(p_name)));
  if not coalesce((v_result->>'success')::boolean,false) then raise exception 'template_create_failed'; end if;
  v_version := (v_result->>'versionId')::bigint;
  v_result := public.manage_phase_template_atomic(jsonb_build_object('action','UPDATE_DRAFT','versionId',v_version,'stages',v_stages));
  if not coalesce((v_result->>'success')::boolean,false) then raise exception 'template_content_failed'; end if;
  v_result := public.manage_phase_template_atomic(jsonb_build_object('action','PUBLISH','versionId',v_version,'reason','Lưu cấu trúc dự án làm mẫu theo yêu cầu quản lý.'));
  if not coalesce((v_result->>'success')::boolean,false) then raise exception 'template_publish_failed'; end if;
  return jsonb_build_object('success',true,'versionId',v_version);
exception when others then
  return jsonb_build_object('success',false,'message','Không thể lưu mẫu. Kiểm tra tên mẫu có trùng hoặc công việc thiếu tên. Dự án vẫn được giữ nguyên.');
end; $$;
revoke all on function public.save_project_template_atomic(bigint,text) from public,anon;
grant execute on function public.save_project_template_atomic(bigint,text) to authenticated,service_role;
