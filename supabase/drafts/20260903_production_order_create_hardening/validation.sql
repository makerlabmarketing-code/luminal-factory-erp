-- READ-ONLY validation for the draft create-RPC replacement.

select
  to_regprocedure('public.create_production_order_atomic(jsonb)') is not null as create_rpc_exists,
  has_function_privilege('authenticated', 'public.create_production_order_atomic(jsonb)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.create_production_order_atomic(jsonb)', 'EXECUTE') as anon_cannot_execute,
  not has_function_privilege('public', 'public.create_production_order_atomic(jsonb)', 'EXECUTE') as public_cannot_execute;

select
  position('completed_quantity, priority, status' in pg_get_functiondef('public.create_production_order_atomic(jsonb)'::regprocedure)) > 0 as server_owned_order_state,
  position('p_payload->>''completedQuantity''' in pg_get_functiondef('public.create_production_order_atomic(jsonb)'::regprocedure)) = 0 as completed_quantity_not_client_owned,
  position('p_payload->>''status''' in pg_get_functiondef('public.create_production_order_atomic(jsonb)'::regprocedure)) = 0 as order_status_not_client_owned,
  position('p_payload->''materialRequirements''' in pg_get_functiondef('public.create_production_order_atomic(jsonb)'::regprocedure)) = 0 as materials_not_client_owned,
  position('update public.inventory' in lower(pg_get_functiondef('public.create_production_order_atomic(jsonb)'::regprocedure))) = 0 as no_inventory_update;

select count(*) = 0 as no_orphan_production_orders
from public.production_orders po
left join public.projects p on p.id = po.project_id
where p.id is null;

select count(*) = 0 as no_order_without_current_stage
from public.production_orders po
left join public.production_stages ps on ps.id = po.current_stage_id and ps.production_order_id = po.id
where ps.id is null;

select count(*) = 0 as no_duplicate_active_production_member
from (
  select production_order_id, employee_id, count(*)
  from public.production_order_members
  where is_active
  group by production_order_id, employee_id
  having count(*) > 1
) duplicates;
