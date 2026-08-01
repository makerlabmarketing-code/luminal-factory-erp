-- DRAFT ONLY. Destructive rollback requires separate approval.
-- Stop unless the object count is exactly zero; deleting Storage metadata does
-- not delete provider objects and must never be used as object cleanup.
begin;

do $$
begin
  if current_setting('luminal.finance_evidence_created_by_package', true) is distinct from 'approved' then
    raise exception 'Rollback blocked: retained forward evidence must confirm this package created the bucket';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'finance-evidence') then
    raise exception 'Rollback blocked: finance-evidence still contains objects';
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
    raise exception 'Rollback blocked: finance-evidence configuration is not package-owned';
  end if;
end $$;

delete from storage.buckets where id = 'finance-evidence';
commit;
