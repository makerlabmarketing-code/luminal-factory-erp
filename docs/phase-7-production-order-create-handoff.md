# Phase 7 Production Order Create Handoff

Date: 2026-09-03

## Completed boundary

Status: `APPLICATION_CREATE_SLICE_COMPLETE / HARDENING_APPLIED / ROLLBACK_FIXTURE_PASS / RUNTIME_DISABLED`.

This slice prepares one create-only Production Order journey. The application:

- requires `ADMIN_WORKSPACE`, `PROJECT_MANAGE`, and `TASK_MANAGE`;
- keeps `PRODUCTION_ORDER_MUTATIONS_ENABLED` server-only and closed unless its exact value is `true`;
- accepts only code, display name, project, product/collection, colorway, planned quantity, target date, priority, Project Manager, and Creative Lead;
- rejects client-owned actor, status, completed quantity, materials, workflow identity, stages, tasks, and member payloads;
- reloads active project membership and verifies the selected `PROJECT_MANAGER` and `CREATIVE_LEAD` roles immediately before calling the RPC;
- derives all active production members and the canonical 12-stage artisan keycap workflow on the server;
- calls `create_production_order_atomic(jsonb)` with the request-scoped authenticated Supabase session so `auth.uid()` remains authoritative;
- links the Vietnamese form only when the server reports the capability enabled;
- locks submission synchronously and redirects to the new detail route after a confirmed response.

No stage transition, task assignment, attachment, notification, material,
inventory, completed-quantity, Production data, or Commerce behavior is added.

## Draft SQL package

`supabase/drafts/20260903_production_order_create_hardening/` contains:

- `forward.sql`: exact create-RPC replacement with strict top-level keys, fixed initial state, canonical stages/tasks, active membership checks, and no inventory writes;
- `rollback.sql`: restores the create RPC shipped by migration `20260722110928`;
- `validation.sql`: read-only function/grant and integrity checks;
- `nonproduction-fixture.sql`: rollback-only operator fixture checklist;
- `REVIEW.md`: scope, security, delivery gate, and rollback notes.

The hardened RPC is applied on Supabase ERP Production. Migration-history reconciliation files are under `supabase/migrations`. The rollback-only fixture passed and persisted zero fixture rows. Runtime activation is still not authorized.

## Repository validation

- `npm test`: PASS, 103 test files / 778 tests.
- `npm run lint`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS with build-only Supabase public placeholders; 39 static pages generated and no Production service contacted.
- `git diff --check`: PASS.
- The focused regression suite verifies the bounded input allowlist, server-derived member roles and 12 stages, request-scoped RPC boundary, server-only runtime gate, duplicate-submit lock, canonical TypeScript/SQL parity, no inventory SQL, and rollback equality with the shipped RPC.

## Activation prerequisites

1. Keep the read-only validation result and rollback reference available.
2. Keep `PRODUCTION_ORDER_MUTATIONS_ENABLED` false or unset.
3. Obtain separate approval before enabling the Production runtime flag.
4. After activation approval, perform exactly one controlled application-level create smoke and verify the order, 12 stages, 11 dependencies, 12 tasks, activity, and unchanged inventory counts.

## Rollback

Before database rollback, set the runtime flag false/unset. Revert the create
page, context route, POST route, mutation service, payload builder, list
capability, tests, and docs. If the hardening SQL was later applied, use the
reviewed `rollback.sql` only under a separate live approval. Existing orders are
not deleted; reverting application code alone has no data-loss risk.

## Next safe slice

The current stop is `RUNTIME_ACTIVATION_APPROVAL_REQUIRED`. SQL hardening and the rollback-only fixture are complete. Stage transitions remain a separate future slice and must not be combined with runtime activation.
