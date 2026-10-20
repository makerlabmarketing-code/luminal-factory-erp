# Finance actors and reversible unpaid payroll close

User request 2026-10-20; user selected reopening only before payment.

- Ledger executor means authenticated approver/payment confirmer, never the staff submitter or selected payer. Show both actors when they differ; historical missing actors remain unknown.
- Payroll close is per employee/month, separate from payment. Closing captures immutable inputs and author. Reopening requires PAYROLL_SETTLE, reason and confirmation; preserves old snapshots in an immutable reopening register, unlocks attendance, and recomputes from live attendance. Closing again creates a new immutable snapshot.
- Reject reopening if any salary payment exists for the employee/month, even without a settlement link. Reject when adjustments exist: these need explicit reconciliation rather than silently dropping them.
- One active settlement per employee/month, protected in the database. New attendance writes and payroll transitions serialize on the employee row. Closing rejects unfinished attendance. Read and admin attendance corrections ignore superseded snapshots only after explicit reopening.
- Adjustment is an approved monetary addition/deduction with visible history, preview and reason. It does not reopen attendance or imply bank transfer. Server reload supplies authoritative totals.
- New reopen capability stays off until reviewed SQL is approved/applied. Existing close/adjust/finance display work with the flag off.
- Only initialize active-snapshot metadata from existing snapshots; no amount/input backfill or snapshot deletion or automatic real payroll/ledger mutations. No automatic payment or email on reopen.
- Draft SQL: new reopening register, unique active-settlement guard, attendance guard; replacements for settle/result/adjust and admin attendance references; payment guard to prevent paying superseded snapshots. Preserve existing immutable triggers and authorization.
- Rollback disables runtime first. Populated reopening history cannot be dropped; restoring original uniqueness requires checking historical duplicates, so prefer forward fixes.
- Validate actors, forged IDs, missing history, denied permissions, paid/adjusted blockers, repeated reopen, reclose, concurrent close/payment/attendance locking, and original-history preservation. No claim of concurrent verification without separate sessions.
