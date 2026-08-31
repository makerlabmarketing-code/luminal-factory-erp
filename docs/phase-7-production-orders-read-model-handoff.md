# Phase 7 Production Orders Read Model Handoff

Date: 2026-08-31

## Completed boundary

Status: `APPLICATION_READ_MODEL_COMPLETE / MUTATIONS_DISABLED`.

The first Phase 7 Production and Operations UI slice adds a permission-aware,
read-only Production Orders workspace. Admin users with `PROJECT_VIEW` or
`PROJECT_MANAGE` can open the list and detail routes through the shared shell.
The list supports Vietnamese search/filter states, local pagination, mobile
cards, desktop table presentation, real quantity progress, and explicit empty,
filtered-empty, loading, stale-data, error, and retry states. Detail shows the
order identity, project/colorway context, current production state, quantity
progress, ordered stages, review requirements, active member count, and material
requirement count without exposing raw Employee identifiers.

The server read model requires `ADMIN_WORKSPACE` plus project view/manage
permission and queries through the request-scoped authenticated Supabase client.
The existing `security_invoker` compatibility views and project RLS remain the
authoritative row-visibility boundary. Both API routes are GET-only and return
`Cache-Control: no-store`.

## Production prerequisite evidence

Read-only production reconciliation confirmed migration
`20260722110928_corrective_slice_6_production_order_persistence` is present.
The reviewed validation package returned PASS for all 15 checks: required
tables, functions and indexes; display-name compatibility; no inventory mutation
artifact; RPC/anonymous grant boundary; no broad write policies; no orphan
orders, stages, members or dependencies; no circular dependencies; and no
duplicate active stage.

## Preserved boundaries

- No create, edit, transition, assignment, attachment, inventory, material,
  notification, or production-quantity mutation is exposed.
- No RPC is called by the read model.
- No migration, schema, RLS, grant, runtime flag, environment value, fixture,
  production row, Storage object, or Commerce code is changed.
- Existing Project, Task, Payroll, Finance, Attendance, and Phase Template
  behavior is unchanged.

## Next safe slice

Continue Phase 7 with a repository and production-readiness audit for the first
write capability. Do not expose Production Order create or stage transitions
until the existing RPC authorization, failure atomicity, audit/activity, and
non-production fixture evidence are reviewed and the mutation scope is approved.
Print Tests, Mold Management, Casting Batches, Quality Control, Inventory, and
Assets remain separate future slices; do not create parallel persistence models.

## Rollback

Revert the Production Order read service/types, GET routes, list/detail pages,
navigation entry, loading messages, regression test, and roadmap/handoff notes.
No database or data rollback is required.
