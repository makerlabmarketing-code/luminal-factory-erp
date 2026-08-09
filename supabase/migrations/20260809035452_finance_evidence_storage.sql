do $$
begin
  if to_regclass('public.finance_expense_attachments') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'financial_ledger' and column_name = 'beneficiary_employee_id'
     ) then
    raise exception 'Dependency 20260728153000 is not ready';
  end if;

  if exists (
    select 1 from storage.buckets
    where id = 'finance-evidence'
      and (
        public is distinct from false
        or file_size_limit is distinct from 10485760
        or allowed_mime_types is null
        or not allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        or cardinality(allowed_mime_types) <> 4
      )
  ) then
    raise exception 'Existing finance-evidence bucket is incompatible; manual review required';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-evidence',
  'finance-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Intentionally no anon/authenticated storage.objects policies.
-- Uploads, reads and cleanup are mediated by authorized server routes using service_role.
