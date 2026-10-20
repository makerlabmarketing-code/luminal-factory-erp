# Payroll reopening delivery package — gated

User approved the rule on 2026-10-20: reopen only before payment. Exact production SQL still requires approval. Do not merge SQL into migrations or enable PAYROLL_REOPEN_ENABLED before approval and postflight.

## Scope and data impact

Add payroll_active_settlements (employee/month primary key, unique settlement FK) and immutable payroll_settlement_reopenings (settlement PK/FK, actor FK, reason and server time). Populate only the active registry from existing snapshots; do not modify payroll inputs, amounts, old settlements, adjustments or financial rows. Replace the historical employee/month unique constraint with the active registry uniqueness enforced by insert triggers and employee locks. Add employee/month lookup index. Keep all existing snapshot immutability triggers.

New tables have RLS, no user policies and no public/anon/authenticated grants; service_role SELECT only. Authenticated reopen RPC enforces admin workspace, PAYROLL_SETTLE and a 10–1000 character reason. Existing privileged calculation/attendance functions preserve their ACLs. Trigger-only SECURITY DEFINER functions have fixed search paths and no public execution; they enforce DB-wide attendance/payment rules. No new role grants or automatic permission assignment.

Replace settle/result/adjust/admin attendance functions to use the active registry. Settle rejects unfinished shifts. Open periods calculate current attendance; closing again creates a new snapshot. Reopen blocks paid salary records by settlement link, employee/month and salary-email snapshots (conservative matching includes cancelled paid records). It also blocks existing adjustments instead of silently losing them. Before adding more rules for refunded/adjusted pay, require explicit reconciliation design.

Payment triggers serialize on employee rows and reject reopened periods or superseded linked snapshots. Legacy paid salary rows with missing employee/month information conservatively block reopening of possibly affected periods. Reconcile their identities/months before retrying. Payment and reopening also share a transaction advisory lock so uncertain identities cannot race the unpaid check. This package does not automatically create, cancel, change amounts on or transfer money for payroll ledger records. The adjustment dialog explains this explicitly.

No production calls to settle/reopen/adjust/payment were made for testing. SQL fixtures run in isolated PGlite. They cover upgrade, active uniqueness, immutable history, reopen/reclose/recalculation, new attendance and admin correction, denied actor, stale/repeated reopen, paid/adjusted/open-shift blockers, stale salary payment and grants. Employee lock order is inspected; multiple simultaneous database-session testing has not been performed. DB deadlocks abort one conflicting transaction and require a retry.

## Delivery

1. Review forward.sql against forward.sha256 and the spec.
2. Obtain approval of exact SQL; create a CLI-generated migration and protected PR delivery. If connector infrastructure still fails, the owner may run the approved SQL in SQL Editor, then reconcile migration metadata.
3. Run validation.sql; expect no invalid/unaccounted snapshots. Check existing salary identity/month completeness before claiming all unpaid checks are reliable.
4. Enable only PAYROLL_REOPEN_ENABLED in production and redeploy. Verify a named unpaid payroll reopen/reclose only when the owner specifies a real record.
5. Rollback first disables the flag. rollback.sql restores functions/uniqueness and removes unused registry schema only if no reopening history or duplicate historical snapshots exists. Otherwise use a forward fix; never drop populated history.

Application-only finance actor display and adjustment dialog can ship with reopening disabled. Payroll settlement actor comes from settled_by_employee_id; ledger actors come from approver_employee_id/payment_confirmer_employee_id, with missing actors shown as unknown. No historical names are inferred from requester/payer text.
