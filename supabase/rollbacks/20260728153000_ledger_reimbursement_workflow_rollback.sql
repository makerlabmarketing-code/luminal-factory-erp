-- Approval required. Rollback is destructive for new reimbursement rows: export them first.
begin;
drop function if exists public.list_my_reimbursements();
drop function if exists public.transition_reimbursement(bigint,text,text,text);
drop function if exists public.submit_my_reimbursement(numeric,date,text,text,bigint,bigint,text,bigint,text,text);
drop trigger if exists finance_ledger_history_immutable on public.finance_ledger_history;
drop trigger if exists financial_ledger_no_delete on public.financial_ledger;
drop function if exists public.block_finance_history_change();
drop function if exists public.block_financial_ledger_delete();
drop table if exists public.finance_ledger_history;
drop table if exists public.finance_expense_attachments;
drop index if exists public.financial_ledger_idempotency_key_unique_idx;
alter table public.financial_ledger drop constraint if exists financial_ledger_reimbursement_status_check, drop constraint if exists financial_ledger_payment_status_check, drop constraint if exists financial_ledger_beneficiary_kind_check, drop constraint if exists financial_ledger_source_identity_unique;
alter table public.financial_ledger drop column if exists cancelled_at,drop column if exists source_reference,drop column if exists source_type,drop column if exists project_id,drop column if exists description,drop column if exists transaction_date,drop column if exists idempotency_key,drop column if exists rejection_reason,drop column if exists payment_note,drop column if exists transfer_reference,drop column if exists paid_at,drop column if exists payment_method,drop column if exists reimbursement_status,drop column if exists approval_status,drop column if exists payment_status,drop column if exists payment_confirmer_employee_id,drop column if exists approver_employee_id,drop column if exists reimbursement_recipient_employee_id,drop column if exists reimbursement_requester_employee_id,drop column if exists creator_employee_id,drop column if exists payer_employee_id,drop column if exists beneficiary_external_name,drop column if exists beneficiary_employee_id;
commit;
