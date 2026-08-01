-- Read-only validation. Expected affected rows: 0.
select
  to_regclass('public.finance_expense_attachments') is not null as reimbursement_attachment_table_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'financial_ledger' and column_name = 'beneficiary_employee_id'
  ) as reimbursement_ledger_columns_ready;

select
  id,
  name,
  public = false as private_bucket,
  file_size_limit = 10485760 as size_limit_ok,
  allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    and cardinality(allowed_mime_types) = 4 as mime_types_ok
from storage.buckets
where id = 'finance-evidence';

select count(*) = 0 as no_direct_client_policy
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and roles && array['anon'::name, 'authenticated'::name]
  and (qual ilike '%finance-evidence%' or with_check ilike '%finance-evidence%');

-- Review every anon/authenticated policy. Policies without an explicit bucket_id
-- predicate are broad candidates even when they do not name finance-evidence.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check,
  coalesce(qual, '') not ilike '%bucket_id%'
    and coalesce(with_check, '') not ilike '%bucket_id%' as broad_policy_candidate
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and roles && array['anon'::name, 'authenticated'::name]
order by policyname;

select
  count(*) as object_count,
  count(*) filter (where name !~ '^[0-9]+/[0-9a-f]{64}\.(jpg|png|webp|pdf)$') as invalid_path_count
from storage.objects
where bucket_id = 'finance-evidence';
