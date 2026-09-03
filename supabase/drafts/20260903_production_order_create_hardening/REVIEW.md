# Production Order Create RPC Hardening — Draft Review

Status: `DRAFT_ONLY / NOT_EXECUTED / RUNTIME_DISABLED`
Date: 2026-09-03

## Scope

This package replaces only `public.create_production_order_atomic(jsonb)`. It does not alter tables, RLS policies, grants for other functions, stage-transition behavior, inventory, materials, attachments, notifications, or Commerce.

The RPC continues to use the request-scoped authenticated session so `auth.uid()` remains the actor authority. `public` and `anon` execution stay revoked. The function performs its own active-employee, workspace, permission, and project checks before writes.

## Integrity changes

- Rejects unknown top-level fields, including actor, order status, completed quantity, material requirements, source order, and workflow identity.
- Forces order state to `NOT_STARTED`, completed quantity to `0`, and material requirements to an empty array.
- Accepts only the canonical 12-stage artisan keycap workflow; phase/stage/task state is derived inside the function.
- Requires an active `PROJECT_MANAGER` and active `CREATIVE_LEAD` membership for the selected employees.
- Requires every production member to be an active project member and rejects duplicate employees.
- Creates the order, stages, dependencies, tasks, and activity inside one PostgreSQL transaction/function call.
- Contains no inventory or material quantity mutation.

## Delivery gate

Do not move `forward.sql` into `supabase/migrations`, execute the fixture, run production SQL, or enable `PRODUCTION_ORDER_MUTATIONS_ENABLED` until the forward SQL, rollback, read-only validation, and non-production fixture have been reviewed and explicitly approved.

## Rollback

Apply `rollback.sql` to restore the exact create function shipped by migration `20260722110928_corrective_slice_6_production_order_persistence.sql`. Application rollback is independent: revert the create service/routes/UI and keep the runtime flag unset or false. Because the runtime flag remains disabled during this delivery, reverting the application creates no production data-loss risk.
