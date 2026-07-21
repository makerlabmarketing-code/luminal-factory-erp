-- Draft only. Do not run without approval.
begin;
drop table if exists public.finance_expense_attachments;
drop index if exists public.financial_ledger_idempotency_key_unique_idx;
alter table public.financial_ledger
  drop column if exists idempotency_key,
  drop column if exists rejection_reason,
  drop column if exists payment_note,
  drop column if exists transfer_reference,
  drop column if exists paid_at,
  drop column if exists payment_method,
  drop column if exists reimbursement_status,
  drop column if exists approval_status,
  drop column if exists payment_status,
  drop column if exists payment_confirmer_employee_id,
  drop column if exists approver_employee_id,
  drop column if exists reimbursement_recipient_employee_id,
  drop column if exists reimbursement_requester_employee_id,
  drop column if exists creator_employee_id,
  drop column if exists payer_employee_id,
  drop column if exists beneficiary_external_name,
  drop column if exists beneficiary_employee_id;
commit;
