# Linked finance ledger edit atomicity package

Status: **READY_FOR_LOCAL_OPERATOR — NOT EXECUTED**.

## Purpose

The current browser flow uses ordered mutations plus compensation so a dependent failure keeps the modal and entered values visible and attempts to restore the original ledger row. That is failure-safe for the normal dependent-error path, but it is not a database atomicity guarantee because the compensating request can also fail.

The reviewed forward draft provides the required single PostgreSQL transaction. It is `SECURITY INVOKER`, locks the primary and linked rows, uses the caller's existing RLS authorization, validates link mode, and commits or rolls back the primary and linked mutation together. No service-role credential is exposed.

## Exact operator sequence

1. Pull latest `main` after the finance PR is merged.
2. Run `supabase/drafts/20260731_finance_linked_ledger_edit_pre_run.sql` read-only.
3. Confirm schema, RLS, policies, ownership, grants, and function prerequisites. Confirm authenticated callers already have precisely the intended ledger INSERT/UPDATE/SELECT RLS access; do not broaden a policy for this function.
4. Apply the approved `SECURITY INVOKER` RPC from `supabase/drafts/20260731_finance_linked_ledger_edit_forward.sql` in one approved local change window.
5. Run `supabase/validation/20260731_finance_linked_ledger_edit_validation.sql` and confirm one `security_definer = false` function, authenticated-only EXECUTE, and ledger RLS enabled.
6. Wire the application to the RPC if it is not already wired.
7. Test CREATE, UPDATE, CANCEL, and NONE in a disposable test transaction.
8. Force a dependent failure and confirm no partial persistence, then roll the test transaction back.
9. Retain pre-run, post-run, functional, forced-failure, and rollback evidence. If validation fails before application activation, run `supabase/drafts/20260731_finance_linked_ledger_edit_rollback.sql`.

No SQL in this package was executed, no production rows were inspected, and no runtime flag was changed.
