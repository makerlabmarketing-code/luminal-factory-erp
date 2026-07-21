-- Draft validation only. Run after approved migration.
select 'financial_ledger_role_columns' as check_name,
  count(*) = 18 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name = 'financial_ledger'
  and column_name in (
    'beneficiary_employee_id','beneficiary_external_name','payer_employee_id','creator_employee_id',
    'reimbursement_requester_employee_id','reimbursement_recipient_employee_id','approver_employee_id',
    'payment_confirmer_employee_id','payment_status','approval_status','reimbursement_status','payment_method',
    'paid_at','transfer_reference','payment_note','rejection_reason','idempotency_key','updated_at'
  );

select 'attachments_private_table_exists' as check_name,
  to_regclass('public.finance_expense_attachments') is not null as passed;

select 'ambiguous_legacy_requested_by_rows' as check_name,
  fl.id, fl.type, fl.category, fl.requested_by
from public.financial_ledger fl
left join public.employees e on e.full_name = fl.requested_by
where fl.requested_by is not null
  and e.id is null;
