-- Corrective Slice 6 Production Order Persistence reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- Scope: durable production orders, reusable workflow templates, production stages,
-- production members, stage dependencies, material requirement placeholders, and
-- transactional RPC entry points. Reuses public.projects, public.phases,
-- public.tasks, public.project_members, public.project_activity, and
-- public.task_notifications instead of creating parallel project/task/member/
-- activity/notification systems.

begin;

-- Preconditions from approved foundations.
do $$
begin
  if to_regclass('public.projects') is null then raise exception 'Precondition failed: public.projects does not exist.'; end if;
  if to_regclass('public.phases') is null then raise exception 'Precondition failed: public.phases does not exist.'; end if;
  if to_regclass('public.tasks') is null then raise exception 'Precondition failed: public.tasks does not exist.'; end if;
  if to_regclass('public.project_members') is null then raise exception 'Precondition failed: public.project_members does not exist.'; end if;
  if to_regclass('public.project_activity') is null then raise exception 'Precondition failed: public.project_activity does not exist.'; end if;
  if to_regclass('public.task_notifications') is null then raise exception 'Precondition failed: public.task_notifications does not exist.'; end if;
  if to_regclass('public.employees') is null then raise exception 'Precondition failed: public.employees does not exist.'; end if;
  if to_regprocedure('public.current_employee_id()') is null then raise exception 'Precondition failed: public.current_employee_id() does not exist.'; end if;
  if to_regprocedure('public.can_view_project(bigint)') is null then raise exception 'Precondition failed: public.can_view_project(bigint) does not exist.'; end if;
  if to_regprocedure('public.has_permission(text)') is null then raise exception 'Precondition failed: public.has_permission(text) does not exist.'; end if;
end $$;

create table if not exists public.production_workflow_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  name text not null,
  version integer not null,
  is_active boolean not null default true,
  sequential boolean not null default true,
  created_by_employee_id bigint references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_workflow_templates_key_not_blank check (length(btrim(template_key)) > 0),
  constraint production_workflow_templates_name_not_blank check (length(btrim(name)) > 0),
  constraint production_workflow_templates_version_positive check (version > 0)
);

create unique index if not exists production_workflow_templates_key_version_idx
  on public.production_workflow_templates (upper(btrim(template_key)), version);

create table if not exists public.production_workflow_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.production_workflow_templates(id) on delete cascade,
  stage_key text not null,
  name text not null,
  sequence integer not null,
  default_duration_days integer null,
  required_role text null,
  requires_review boolean not null default false,
  depends_on_previous boolean not null default true,
  dependency_definition jsonb not null default '[]'::jsonb,
  task_definitions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint production_template_stages_key_not_blank check (length(btrim(stage_key)) > 0),
  constraint production_template_stages_name_not_blank check (length(btrim(name)) > 0),
  constraint production_template_stages_sequence_positive check (sequence > 0),
  constraint production_template_stages_duration_positive check (default_duration_days is null or default_duration_days > 0),
  constraint production_template_stages_dependency_array check (jsonb_typeof(dependency_definition) = 'array'),
  constraint production_template_stages_tasks_array check (jsonb_typeof(task_definitions) = 'array')
);

create unique index if not exists production_template_stages_template_sequence_idx
  on public.production_workflow_template_stages (template_id, sequence);
create unique index if not exists production_template_stages_template_key_idx
  on public.production_workflow_template_stages (template_id, upper(btrim(stage_key)));

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  production_code text not null,
  display_name text null,
  project_id bigint not null references public.projects(id) on delete restrict,
  product_or_collection text not null,
  colorway text not null,
  planned_quantity integer not null,
  completed_quantity integer not null default 0,
  priority text not null default 'NORMAL',
  status text not null default 'NOT_STARTED',
  current_stage_id uuid null,
  target_completion_date date null,
  workflow_template_id uuid null references public.production_workflow_templates(id) on delete set null,
  workflow_template_version integer null,
  source_production_order_id uuid null references public.production_orders(id) on delete set null,
  project_manager_employee_id bigint not null references public.employees(id) on delete restrict,
  creative_lead_employee_id bigint not null references public.employees(id) on delete restrict,
  created_by_employee_id bigint not null references public.employees(id) on delete restrict,
  material_requirements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_orders_code_not_blank check (length(btrim(production_code)) > 0),
  constraint production_orders_product_not_blank check (length(btrim(product_or_collection)) > 0),
  constraint production_orders_colorway_not_blank check (length(btrim(colorway)) > 0),
  constraint production_orders_planned_quantity_positive check (planned_quantity > 0),
  constraint production_orders_completed_quantity_valid check (completed_quantity >= 0 and completed_quantity <= planned_quantity),
  constraint production_orders_priority_check check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  constraint production_orders_status_check check (status in ('DRAFT','NOT_STARTED','PREPARING','IN_PRODUCTION','PENDING_REVIEW','ON_HOLD','BLOCKED','COMPLETED','CANCELLED')),
  constraint production_orders_material_requirements_array check (jsonb_typeof(material_requirements) = 'array')
);

create unique index if not exists production_orders_code_unique_idx
  on public.production_orders (upper(btrim(production_code)));
create index if not exists production_orders_project_id_idx on public.production_orders(project_id);
create index if not exists production_orders_status_idx on public.production_orders(status);

create table if not exists public.production_stages (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  project_id bigint not null references public.projects(id) on delete cascade,
  phase_id bigint null references public.phases(id) on delete set null,
  template_stage_id uuid null references public.production_workflow_template_stages(id) on delete set null,
  stage_key text not null,
  name text not null,
  sequence integer not null,
  status text not null default 'LOCKED',
  owner_employee_id bigint null references public.employees(id) on delete set null,
  deadline date null,
  progress integer not null default 0,
  requires_review boolean not null default false,
  review_status text not null default 'NOT_SUBMITTED',
  review_approved_by_employee_id bigint null references public.employees(id) on delete set null,
  review_approved_at timestamptz null,
  override_by_employee_id bigint null references public.employees(id) on delete set null,
  override_reason text null,
  activated_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_stages_key_not_blank check (length(btrim(stage_key)) > 0),
  constraint production_stages_name_not_blank check (length(btrim(name)) > 0),
  constraint production_stages_sequence_positive check (sequence > 0),
  constraint production_stages_progress_valid check (progress between 0 and 100),
  constraint production_stages_status_check check (status in ('LOCKED','READY','IN_PROGRESS','PENDING_REVIEW','COMPLETED','ON_HOLD','BLOCKED','SKIPPED_WITH_APPROVAL')),
  constraint production_stages_review_status_check check (review_status in ('NOT_SUBMITTED','SUBMITTED','PENDING_REVIEW','APPROVED','REVISION_REQUESTED','REJECTED')),
  constraint production_stages_override_reason_required check ((status <> 'SKIPPED_WITH_APPROVAL') or (override_by_employee_id is not null and length(btrim(coalesce(override_reason,''))) > 0)),
  constraint production_stages_completed_state_check check ((status not in ('COMPLETED','SKIPPED_WITH_APPROVAL') and completed_at is null) or (status in ('COMPLETED','SKIPPED_WITH_APPROVAL') and completed_at is not null))
);

alter table public.production_orders
  add constraint production_orders_current_stage_fkey
  foreign key (current_stage_id) references public.production_stages(id) on delete set null;

create unique index if not exists production_stages_order_sequence_idx on public.production_stages(production_order_id, sequence);
create unique index if not exists production_stages_single_active_idx on public.production_stages(production_order_id) where status = 'IN_PROGRESS';
create index if not exists production_stages_project_idx on public.production_stages(project_id);
create index if not exists production_stages_phase_idx on public.production_stages(phase_id) where phase_id is not null;

create table if not exists public.production_stage_dependencies (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  stage_id uuid not null references public.production_stages(id) on delete cascade,
  depends_on_stage_id uuid not null references public.production_stages(id) on delete cascade,
  dependency_type text not null default 'FINISH_TO_START',
  created_at timestamptz not null default now(),
  constraint production_stage_dependencies_no_self check (stage_id <> depends_on_stage_id),
  constraint production_stage_dependencies_type_check check (dependency_type in ('FINISH_TO_START'))
);

create unique index if not exists production_stage_dependencies_unique_idx
  on public.production_stage_dependencies(stage_id, depends_on_stage_id);
create index if not exists production_stage_dependencies_order_idx
  on public.production_stage_dependencies(production_order_id);

create table if not exists public.production_order_members (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  project_member_id bigint not null references public.project_members(id) on delete restrict,
  employee_id bigint not null references public.employees(id) on delete restrict,
  production_role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_order_members_role_check check (production_role in ('PROJECT_MANAGER','CREATIVE_LEAD','MEMBER','REVIEWER'))
);

create unique index if not exists production_order_members_active_unique_idx
  on public.production_order_members(production_order_id, employee_id, production_role) where is_active;
create index if not exists production_order_members_employee_idx on public.production_order_members(employee_id);

-- Reuse existing activity/outbox structures by adding production metadata columns.
alter table public.project_activity
  add column if not exists production_order_id uuid references public.production_orders(id) on delete cascade,
  add column if not exists production_stage_id uuid references public.production_stages(id) on delete set null;
alter table public.project_activity drop constraint if exists project_activity_activity_type_check;
alter table public.project_activity add constraint project_activity_activity_type_check check (activity_type in (
  'TASK_CREATED','TASK_UPDATED','TASK_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED',
  'PRODUCTION_ORDER_CREATED','PRODUCTION_STAGE_ACTIVATED','PRODUCTION_STAGE_COMPLETED','PRODUCTION_STAGE_OVERRIDDEN'
));
create index if not exists project_activity_production_order_created_idx
  on public.project_activity(production_order_id, created_at desc) where production_order_id is not null;

alter table public.task_notifications
  add column if not exists production_order_id uuid references public.production_orders(id) on delete cascade,
  add column if not exists production_stage_id uuid references public.production_stages(id) on delete set null,
  add column if not exists dedupe_key text;
create unique index if not exists task_notifications_dedupe_key_unique_idx
  on public.task_notifications(dedupe_key) where dedupe_key is not null;

-- Protected metadata only; storage bytes remain in private buckets and no public access is granted.
create table if not exists public.production_attachment_metadata (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  production_stage_id uuid null references public.production_stages(id) on delete set null,
  task_id bigint null references public.tasks(id) on delete set null,
  uploaded_by_employee_id bigint not null references public.employees(id) on delete restrict,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  visibility text not null default 'PROJECT_MEMBERS',
  created_at timestamptz not null default now(),
  constraint production_attachment_bucket_not_blank check (length(btrim(storage_bucket)) > 0),
  constraint production_attachment_path_not_blank check (length(btrim(storage_path)) > 0 and storage_path !~ '[[:cntrl:]]'),
  constraint production_attachment_filename_not_blank check (length(btrim(original_filename)) > 0),
  constraint production_attachment_size_valid check (size_bytes > 0 and size_bytes <= 10485760),
  constraint production_attachment_visibility_check check (visibility in ('PROJECT_MEMBERS','ASSIGNED_TASK','MANAGERS_ONLY')),
  constraint production_attachment_mime_check check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf','model/stl','application/octet-stream'))
);

create unique index if not exists production_attachment_storage_unique_idx
  on public.production_attachment_metadata(storage_bucket, storage_path);
create index if not exists production_attachment_order_created_idx
  on public.production_attachment_metadata(production_order_id, created_at desc);

create or replace function public.set_production_updated_at()
returns trigger
language plpgsql
set search_path = public, auth, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_production_workflow_templates_updated_at on public.production_workflow_templates;
drop trigger if exists set_production_orders_updated_at on public.production_orders;
drop trigger if exists set_production_stages_updated_at on public.production_stages;
drop trigger if exists set_production_order_members_updated_at on public.production_order_members;
create trigger set_production_workflow_templates_updated_at before update on public.production_workflow_templates for each row execute function public.set_production_updated_at();
create trigger set_production_orders_updated_at before update on public.production_orders for each row execute function public.set_production_updated_at();
create trigger set_production_stages_updated_at before update on public.production_stages for each row execute function public.set_production_updated_at();
create trigger set_production_order_members_updated_at before update on public.production_order_members for each row execute function public.set_production_updated_at();

create or replace function public.detect_production_stage_dependency_cycle()
returns trigger
language plpgsql
set search_path = public, auth, pg_temp
as $$
begin
  if new.stage_id = new.depends_on_stage_id then
    raise exception 'Stage cannot depend on itself.';
  end if;

  if exists (
    with recursive dependency_walk(stage_id, depends_on_stage_id) as (
      select new.stage_id, new.depends_on_stage_id
      union all
      select d.stage_id, d.depends_on_stage_id
      from public.production_stage_dependencies d
      join dependency_walk w on d.stage_id = w.depends_on_stage_id
      where d.production_order_id = new.production_order_id
    )
    select 1 from dependency_walk where depends_on_stage_id = new.stage_id
  ) then
    raise exception 'Circular production stage dependency is not allowed.';
  end if;

  return new;
end;
$$;

drop trigger if exists detect_production_stage_dependency_cycle on public.production_stage_dependencies;
create trigger detect_production_stage_dependency_cycle before insert or update on public.production_stage_dependencies for each row execute function public.detect_production_stage_dependency_cycle();

-- Transactional RPC is the only approved mutation boundary for order creation.
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

create or replace function public.transition_production_stage_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_employee_id bigint;
  v_stage_id uuid := nullif(p_payload->>'stageId','')::uuid;
  v_target_status text := nullif(p_payload->>'targetStatus','');
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_stage public.production_stages%rowtype;
begin
  if v_actor is null then return jsonb_build_object('success', false, 'code', 'session_not_verified', 'message', 'Phiên đăng nhập không hợp lệ.'); end if;
  select e.id into v_employee_id from public.employees e where e.auth_user_id=v_actor and coalesce(e.is_active,true)=true and coalesce(e.status,'ACTIVE')='ACTIVE' limit 1;
  if v_employee_id is null then return jsonb_build_object('success', false, 'code', 'actor_not_allowed', 'message', 'Không thể xác định nhân sự thao tác.'); end if;
  select * into v_stage from public.production_stages where id=v_stage_id for update;
  if not found or not public.can_view_project(v_stage.project_id) then return jsonb_build_object('success', false, 'code', 'stage_not_allowed', 'message', 'Giai đoạn không hợp lệ hoặc bạn không có quyền truy cập.'); end if;
  if not (public.has_permission('TASK_MANAGE') or public.has_permission('TASK_REVIEW')) then return jsonb_build_object('success', false, 'code', 'permission_forbidden', 'message', 'Bạn không có quyền cập nhật giai đoạn.'); end if;
  if v_stage.status in ('COMPLETED','SKIPPED_WITH_APPROVAL') then return jsonb_build_object('success', false, 'code', 'completed_stage_read_only', 'message', 'Giai đoạn đã hoàn thành không thể sửa.'); end if;
  if v_target_status = 'IN_PROGRESS' and v_stage.status <> 'READY' then return jsonb_build_object('success', false, 'code', 'invalid_stage_transition', 'message', 'Chỉ giai đoạn sẵn sàng mới được kích hoạt.'); end if;
  if v_target_status = 'IN_PROGRESS' and exists (select 1 from public.production_stages where production_order_id=v_stage.production_order_id and status='IN_PROGRESS' and id<>v_stage.id) then return jsonb_build_object('success', false, 'code', 'duplicate_active_stage', 'message', 'Chỉ được có một giai đoạn đang thực hiện.'); end if;
  if v_target_status = 'COMPLETED' and exists (select 1 from public.tasks t where t.phase_id=v_stage.phase_id and coalesce(t.status,'BACKLOG') not in ('COMPLETED','APPROVED')) then return jsonb_build_object('success', false, 'code', 'required_tasks_unfinished', 'message', 'Cần hoàn thành công việc bắt buộc trước khi đóng giai đoạn.'); end if;
  if v_target_status = 'COMPLETED' and v_stage.requires_review and v_stage.review_status <> 'APPROVED' then return jsonb_build_object('success', false, 'code', 'stage_review_required', 'message', 'Giai đoạn cần được duyệt trước khi hoàn thành.'); end if;
  if v_target_status = 'SKIPPED_WITH_APPROVAL' and (not public.has_permission('TASK_REVIEW') or v_reason is null) then return jsonb_build_object('success', false, 'code', 'override_reason_required', 'message', 'Cần quyền duyệt và lý do ghi đè.'); end if;
  update public.production_stages set status=v_target_status, activated_at=case when v_target_status='IN_PROGRESS' then now() else activated_at end, completed_at=case when v_target_status in ('COMPLETED','SKIPPED_WITH_APPROVAL') then now() else completed_at end, override_by_employee_id=case when v_target_status='SKIPPED_WITH_APPROVAL' then v_employee_id else override_by_employee_id end, override_reason=case when v_target_status='SKIPPED_WITH_APPROVAL' then v_reason else override_reason end where id=v_stage.id;
  return jsonb_build_object('success', true, 'stageId', v_stage.id, 'status', v_target_status);
end;
$$;

revoke all on function public.transition_production_stage_atomic(jsonb) from public, anon;
grant execute on function public.transition_production_stage_atomic(jsonb) to authenticated;

commit;
