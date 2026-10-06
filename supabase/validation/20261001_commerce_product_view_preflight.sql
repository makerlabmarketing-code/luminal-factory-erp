-- READ ONLY. Run before and after any targeted authorization grant.
select
  (select count(*) from public.permissions where code = 'COMMERCE_PRODUCT_VIEW') as catalog_rows,
  (select count(*) from public.employee_permissions where permission_code = 'COMMERCE_PRODUCT_VIEW' and status = 'ACTIVE' and revoked_at is null and effect = 'ALLOW') as active_allow_rows,
  (select count(*) from public.employee_permissions where permission_code = 'COMMERCE_PRODUCT_VIEW' and status = 'ACTIVE' and revoked_at is null and effect = 'DENY') as active_deny_rows,
  (select count(*) from public.employee_workspace_access where workspace='ADMIN_WORKSPACE' and status='ACTIVE' and revoked_at is null) as admin_workspace_rows;

-- Never dump unmasked user emails or auth tokens in deployment reports.
-- Match the exact user account with employees.auth_user_id (not employee name/role).
