# Payroll and ledger continuity — 2026-10-19

User requested removing the duplicate payroll action from Attendance and asked
whether settlement creates a ledger entry, how zero-value settlements behave,
and whether test ledger records can be removed.

## Verified current behavior

- Attendance contains a disabled placeholder payroll button; the working payroll
  screen is a separate navigation entry. Remove only the redundant placeholder.
- The live settle_monthly_payroll(bigint,date) function writes the immutable
  payroll settlement and payroll audit event. It does not insert financial_ledger.
  No settlement/adjustment trigger connects it to the ledger.
- Read-only Production counts: one settlement, with zero base salary; zero
  zero-amount ledger rows and zero SALARY/PAYROLL source ledger rows. This does not
  identify any record as disposable test data.
- The ledger API supports create/update/paid operations, not DELETE. The database
  financial_ledger_no_delete trigger blocks physical deletion. Payroll snapshots
  and adjustments also have immutability triggers.
- Salary payment email belongs to the ledger's explicit paid confirmation; payroll
  settlement alone is not proof that money was transferred.

## Proposed next slice — not implemented here

For a positive payable amount, settlement should atomically create exactly one
unpaid salary obligation linked by stable settlement/employee IDs; retry must not
duplicate it. Financial payment and email remain explicit downstream actions.
Negative adjustments and payment reconciliation require a specified policy.

Recommendation: zero payable amounts remain visible as settled/no-payment-due in
payroll, without a cash ledger entry or salary-payment email. Confirm this intent
before changing the financial contract. No zero settlement was deleted or changed.

Test cleanup needs an exact ID and verification that no actual payment, attachment,
counter-entry, settlement or salary-email receipt depends on it. Do not infer test
status from amount, name or age, or disable the global delete guard. A scoped test
cleanup or auditable cancellation capability requires its own reviewed package.

No Production schema, salary, ledger, grants, flags or mail changed in this slice.
The UI rollback is to restore the removed placeholder; payroll behavior is intact.
