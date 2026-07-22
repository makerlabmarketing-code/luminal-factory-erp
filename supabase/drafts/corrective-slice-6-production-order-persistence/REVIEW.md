# Corrective Slice 6 Production Order Persistence Package Review

Date: 2026-07-22

## Package files

- `forward.sql` — draft DDL/RPC package for durable production orders, templates, stages, stage dependencies, production members, protected attachment metadata, and existing activity/notification integration.
- `rollback.sql` — guarded rollback package that refuses to drop Slice 6 objects when operational production rows, attachment metadata, production notifications, or production activity exist.
- `validation.sql` — read-only pre/post validation package.
- `compatibility.sql` — read-only compatibility views for list/detail reads using security invoker semantics.
- `security/RLS.sql` — RLS/grant package with select-only authenticated policies and RPC-only mutation boundaries.
- `attachment-policy.sql` — protected attachment metadata access package; no public storage access.
- `notification-outbox.sql` — integration with existing `task_notifications` outbox and idempotent `dedupe_key`.
- `backfill-plan.md` — no automatic legacy backfill; future backfill remains a separate approval gate.

## Review findings

- PASS: Reuses existing `projects`, `phases`, `tasks`, `project_members`, `project_activity`, and `task_notifications`; does not create parallel project/task/member/activity/notification systems.
- PASS: Production-code uniqueness is enforced on normalized `upper(btrim(production_code))`; duplicate display names remain allowed.
- PASS: Workflow template version is preserved on `production_orders.workflow_template_version`.
- PASS: Stage sequencing, single active sequential stage, circular dependency prevention, required task completion, review approval, override reason, completed-stage read-only behavior, and invalid transition checks are represented in constraints/triggers/RPC boundaries.
- PASS: Mutations are exposed only through reviewed RPC functions; no anonymous or broad authenticated browser write policies are added for production tables.
- PASS: Authorization uses server-derived `auth.uid()` / `current_employee_id()`, active employee checks, `can_view_project`, `PROJECT_MANAGE`, `TASK_MANAGE`, and `TASK_REVIEW` gates.
- PASS: Attachment metadata is protected and private; the package does not create public bucket/object access.
- PASS: Notifications reuse `task_notifications` and add idempotency metadata instead of creating a separate outbox.
- PASS: Material requirements are JSON placeholder metadata only; no inventory quantity, stock reservation, or procurement mutation appears in the package.
- PASS: Rollback is guarded and remains valid only before operational production rows are created or after an approved preservation/cleanup decision.

## Stop point

This is a reviewed draft package only. Do not execute any SQL until `LIVE_APPROVAL_REQUIRED` is explicitly granted for this package and read-only pre-validation passes immediately before rollout.
