# Commerce Product View: targeted ERP grant preparation (2026-10-01)

**State:** PRODUCTION TARGETED GRANT APPLIED / DB VERIFICATION PASSED / AUTHENTICATED ERP UI SMOKE PENDING.

## Existing contracts and scope

- ERP PR #217 already deployed the read-only Products page, server HMAC adapter and the dedicated `COMMERCE_PRODUCT_VIEW` application capability.
- Commerce PR #101 hardened the existing signed `GET /api/admin/v1/products` read endpoint.
- Live ERP database currently has no `COMMERCE_PRODUCT_VIEW` entry in `public.permissions` and no active grant.
- ERP access checks require authenticated `auth.users.id -> employees.auth_user_id -> employees.id`, an active `ADMIN_WORKSPACE` row and `COMMERCE_PRODUCT_VIEW` (OWNER has an existing application-side permission bypass, but still needs an active workspace).
- Owner provided the ERP login email in chat and the database matched one exact active Auth-linked OWNER and one Admin Workspace grant. Identifying email/UUID are intentionally excluded from this repository.

## Production execution result (2026-10-01)

- Migration **`grant_commerce_product_view_to_verified_owner_20261001`** applied successfully to Luminal Factory ERP Supabase (`kwfmfmpgpbfewpiizesv`).
- Migration resolved the target inside the database through matching employee and authenticated user emails, active OWNER role, one active Admin Workspace grant, and no DENY override. It did **not** hardcode generated employee or Auth user IDs into source control.
- Post-check: exactly 1 catalog code, 1 active ALLOW (verified intended target), 0 active DENY, 0 active grant for other users.
- Admin Workspace count remains 3; Hero permission grant counts remain unchanged.
- No Vercel environment or HMAC changes, no Commerce database mutations, no Product/price/inventory writes, no Hero updates.
- **Outstanding:** signed ERP-session smoke of `/admin/commerce/products` as the actual logged-in owner. A database-level grant alone does not prove the end-to-end page succeeded.

## Operator gates

1. Before repeating the grant, ask the user to identify the **exact email of the currently signed-in ERP Admin account**, privately through chat (never commit it). Independently find its exact `employees.auth_user_id`, employee ID and active status via read-only database query. Stop unless **exactly one** employee and one active Admin Workspace membership match.
2. Confirm no active DENY override and review pre-change permission count for the exact target. Do not grant to the OWNER/ADMIN role as a group.
3. Copy `supabase/drafts/20261001_commerce_product_view_target_grant.sql` into an execution-specific reviewed migration, substitute **both** explicit IDs only after validation and check that the transaction fails closed for unexpected state. Do not promote an unbound template into migrations. Apply through the reviewed Supabase migration workflow; no ad hoc write through a read-only inspection step.
4. Re-run `supabase/validation/20261001_commerce_product_view_preflight.sql` plus exact target count checks. Expect 1 catalog row, one new active ALLOW for the intended employee (unless they already had one), no new DENY, no grants to anyone else.
5. Test the route using the **real authenticated ERP session** with the user's permission. Verify list is read-only, no client-side HMAC key, and Hero config/published item unchanged. HMAC environment and flags remain untouched. Retain rollback and deployment evidence.

## Rollback

Revoke only the specifically approved new grant by marking its `employee_permissions` record INACTIVE and setting `revoked_at` through the approved authorization management path. Do not bulk delete audit history or remove other permissions. The catalog code may remain registered safely; dropping it could affect existing references.

## Stop conditions

Unconfirmed identity, more than one match, missing Auth link, inactive employee/workspace, existing DENY, unexpected change in counts, request fails authentication, any unexpected Production writes, or Hero regressions.
