-- Read-only post-run validation. No legacy row is inferred or rewritten.
select to_regclass('public.finance_ledger_history') is not null as history_exists,
       to_regclass('public.finance_expense_attachments') is not null as attachments_exists,
       to_regprocedure('public.submit_my_reimbursement(numeric,date,text,text,bigint,bigint,text,bigint,text,text)') is not null as submit_rpc_exists,
       to_regprocedure('public.transition_reimbursement(bigint,text,text,text)') is not null as transition_rpc_exists;
select count(*)=23 as ledger_columns_present from information_schema.columns where table_schema='public' and table_name='financial_ledger' and column_name in ('beneficiary_employee_id','beneficiary_external_name','payer_employee_id','creator_employee_id','reimbursement_requester_employee_id','reimbursement_recipient_employee_id','approver_employee_id','payment_confirmer_employee_id','payment_status','approval_status','reimbursement_status','payment_method','paid_at','transfer_reference','payment_note','rejection_reason','idempotency_key','transaction_date','description','project_id','source_type','source_reference','cancelled_at');
select tablename,policyname,roles,cmd from pg_policies where schemaname='public' and tablename in ('finance_ledger_history','finance_expense_attachments') order by 1,2;
select count(*) as legacy_salary_rows_after from public.financial_ledger where lower(coalesce(type,'')) like '%luong%' or lower(coalesce(category,'')) like '%lương%';
select count(*) as invalid_status_rows from public.financial_ledger where reimbursement_status is not null and reimbursement_status not in ('DRAFT','SUBMITTED','APPROVED','REJECTED','PAID','CANCELLED');
