# Corrective Slice 6 Production Order Persistence Backfill Plan

Status: reviewed draft only. Do not execute before `LIVE_APPROVAL_REQUIRED`.

## Current decision

No automatic legacy production-order backfill is included in this package.

The application-only workflow introduced stable production-order concepts, but the current repository does not contain a durable legacy production-order source that can be mapped without guessing product/collection, colorway, planned quantity, template version, manager, creative lead, stage ownership, dependencies, attachments, or material requirements.

## Safe rollout path

1. Run `validation.sql` as read-only pre-validation.
2. Confirm no equivalent production-order tables/RPC/policies already exist.
3. Apply only the reviewed package after live approval.
4. Seed reusable workflow templates only from reviewed template payloads if separately approved.
5. Wire new production-order creation to `public.create_production_order_atomic(jsonb)`.
6. Do not backfill historical rows unless a human-provided mapping file specifies every required stable identifier.

## Backfill gate

A future backfill requires a separate approval package containing:

- source record inventory
- deterministic mapping for project, product/collection, colorway, planned quantity, manager, creative lead, template version, stages, members, tasks, activity, and protected attachments
- duplicate production-code strategy
- rollback plan
- orphan and circular-dependency validation
- confirmation that inventory quantities remain unchanged

## Inventory/material handling

This package stores only `production_orders.material_requirements` placeholder metadata. It does not decrement stock, reserve stock, create procurement records, or mutate inventory quantities. Durable material usage remains a future approval gate.
