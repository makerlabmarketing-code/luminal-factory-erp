-- Deactivate only rows recorded as new by the rollout operator. Preserve all references.
-- Bind these IDs from the post-rollout verification to the deployment change record.
-- This script intentionally does not infer the affected IDs from names.
begin;
update public.shareholders
set status = 'INACTIVE', updated_at = clock_timestamp()
where id = any(coalesce(nullif(current_setting('app.finance_seed_source_ids', true), ''), '{}')::bigint[])
  and name in ('Nguyễn Sơn Hà', 'Đào Tùng Duy')
  and status = 'ACTIVE'
  and share_percentage = 0
  and contributed_amount = 0;
commit;
