-- Additional SELECT restriction; existing grants and permissive policies remain.
begin;
create schema erp_ledger_access;
revoke all on schema erp_ledger_access from public,anon,authenticated,service_role;
grant usage on schema erp_ledger_access to authenticated;
create function erp_ledger_access.is_owner() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees e
 where e.auth_user_id=(select auth.uid()) and e.status='ACTIVE'
 and coalesce(e.is_active,true) and upper(btrim(e.role))='OWNER');
$$;
revoke all on function erp_ledger_access.is_owner() from public,anon,authenticated,service_role;
grant execute on function erp_ledger_access.is_owner() to authenticated;
create policy ledger_deleted_owner_select on public.financial_ledger
 as restrictive for select to authenticated
 using(cancelled_at is null or (select erp_ledger_access.is_owner()));
CREATE OR REPLACE FUNCTION public.list_my_reimbursements()
 RETURNS TABLE(id bigint, type text, category text, amount numeric, bill_url text, transaction_date date, description text, project_id bigint, beneficiary_employee_id bigint, beneficiary_name text, month_period text, payer_employee_id bigint, payer_name text, reimbursement_status text, rejection_reason text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
 select fl.id,fl.type,fl.category,fl.amount,fl.bill_url,fl.transaction_date,fl.description,fl.project_id,fl.beneficiary_employee_id,coalesce(b.full_name,fl.beneficiary_external_name,'Chưa xác định'),fl.month_period,fl.payer_employee_id,p.full_name,fl.reimbursement_status,fl.rejection_reason,fl.created_at
 from public.financial_ledger fl left join public.employees b on b.id=fl.beneficiary_employee_id left join public.employees p on p.id=fl.payer_employee_id
 where (fl.cancelled_at is null or (select erp_ledger_access.is_owner())) and public.has_workspace_access('STAFF_WORKSPACE') and (fl.reimbursement_requester_employee_id=public.current_employee_id() or fl.beneficiary_employee_id=public.current_employee_id()) order by fl.id desc;
$function$;
commit;
