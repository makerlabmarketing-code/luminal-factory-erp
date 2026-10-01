# Commerce Product View: targeted ERP grant preparation (2026-10-01)

**State:** PREPARED / NOT EXECUTED / USER ACCOUNT UNCONFIRMED.

## Existing contracts and scope

- ERP PR #217 already deployed the read-only Products page, server HMAC adapter and the dedicated `COMMERCE_PRODUCT_VIEW` application capability.
- Commerce PR #101 hardened the existing signed `GET /api/admin/v1/products` read endpoint.
- Live ERP database currently has no `COMMERCE_PRODUCT_VIEW` entry in `public.permissions` and no active grant.
- ERP access checks require authenticated `auth.users.id -> employees.auth_user_id -> employees.id`, an active `ADMIN_WORKSPACE` row and `COMMERCE_PRODUCT_VIEW` (OWNER has an existing application-side permission bypass, but still needs an active workspace).
- **The user has not yet identified which ERP Auth-linked account is theirs. No target account may be assumed from role or email prefix.**

## Operator gates

1. Ask the user to identify the **exact email of the currently signed-in ERP Admin account**, privately through chat (never commit it). Independently find its exact `employees.auth_user_id`, employee ID and active status via read-only database query. Stop unless **exactly one** employee and one active Admin Workspace membership match.
2. Confirm no active DENY override and review pre-change permission count for the exact target. Do not grant to the OWNER/ADMIN role as a group.
3. Copy `supabase/drafts/20261001_commerce_product_view_target_grant.sql` into an execution-specific reviewed migration, substitute **both** explicit IDs only after validation and check that the transaction fails closed for unexpected state. Do not promote an unbound template into migrations. Apply through the reviewed Supabase migration workflow; no ad hoc write through a read-only inspection step.
4. Re-run `supabase/validation/20261001_commerce_product_view_preflight.sql` plus exact target count checks. Expect 1 catalog row, one new active ALLOW for the intended employee (unless they already had one), no new DENY, no grants to anyone else.
5. Test the route using the **real authenticated ERP session** with the user's permission. Verify list is read-only, no client-side HMAC key, and Hero config/published item unchanged. HMAC environment and flags remain untouched. Retain rollback and deployment evidence.

## Rollback

Revoke only the specifically approved new grant by marking its `employee_permissions` record INACTIVE and setting `revoked_at` through the approved authorization management path. Do not bulk delete audit history or remove other permissions. The catalog code may remain registered safely; dropping it could affect existing references.

## Stop conditions

Unconfirmed identity, more than one match, missing Auth link, inactive employee/workspace, existing DENY, unexpected change in counts, request fails authentication, any unexpected Production writes, or Hero regressions.
