-- Draft only. Do not run without LIVE_APPROVAL_REQUIRED approval.
-- Corrective Slice 3B finance beneficiary/payer/reimbursement/receipt workflow.

begin;

alter table public.financial_ledger
  add column if not exists beneficiary_employee_id bigint references public.employees(id),
  add column if not exists beneficiary_external_name text,
  add column if not exists payer_employee_id bigint references public.employees(id),
  add column if not exists creator_employee_id bigint references public.employees(id),
  add column if not exists reimbursement_requester_employee_id bigint references public.employees(id),
  add column if not exists reimbursement_recipient_employee_id bigint references public.employees(id),
  add column if not exists approver_employee_id bigint references public.employees(id),
  add column if not exists payment_confirmer_employee_id bigint references public.employees(id),
  add column if not exists payment_status text not null default 'UNPAID',
  add column if not exists approval_status text not null default 'NOT_REQUIRED',
  add column if not exists reimbursement_status text,
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists transfer_reference text,
  add column if not exists payment_note text,
  add column if not exists rejection_reason text,
  add column if not exists idempotency_key text;

create unique index if not exists financial_ledger_idempotency_key_unique_idx
  on public.financial_ledger (idempotency_key)
  where idempotency_key is not null;

create table if not exists public.finance_expense_attachments (
  id bigserial primary key,
  financial_ledger_id bigint not null references public.financial_ledger(id) on delete cascade,
  uploaded_by_employee_id bigint not null references public.employees(id),
  attachment_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  verification_state text not null default 'UNVERIFIED',
  created_at timestamptz not null default now(),
  constraint finance_expense_attachments_mime_type_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint finance_expense_attachments_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint finance_expense_attachments_path_check check (storage_path !~ '[[:cntrl:]]')
);

alter table public.finance_expense_attachments enable row level security;

-- RLS plan: SELECT only for FINANCE_VIEW or row-owner employee self-service reimbursement visibility;
-- INSERT through reviewed server boundary only; no public URLs for protected finance documents.

commit;
