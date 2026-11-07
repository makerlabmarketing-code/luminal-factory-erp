select has_function_privilege('service_role', 'public.record_personal_advance_refund(bigint,numeric,bigint,uuid)', 'EXECUTE') as server_only,
       not has_function_privilege('authenticated', 'public.record_personal_advance_refund(bigint,numeric,bigint,uuid)', 'EXECUTE') as browser_denied;

select a.ledger_id
from public.finance_personal_advances a
join public.financial_ledger original on original.id = a.ledger_id
join public.financial_ledger counter on counter.id = a.counter_id
where counter.cancelled_at is not null or counter.amount <> original.amount
   or original.amount < coalesce((select sum(l.amount) from public.finance_personal_advance_refunds r
       join public.financial_ledger l on l.id = r.ledger_id where r.advance_id = a.ledger_id), 0);
