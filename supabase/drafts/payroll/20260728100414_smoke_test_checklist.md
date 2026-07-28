# Payroll operator smoke test

1. Keep `PAYROLL_SETTLEMENT_ENABLED=false`; run pre-run SQL and retain results.
2. Review forward migration, RLS, grants, rollback, and validation; merge only through protected `main` after approval.
3. Run post-run validation. Grant `PAYROLL_CONFIGURE`, `PAYROLL_VIEW`, `PAYROLL_SETTLE`, and `PAYROLL_ADJUST` only to authorized fixtures.
4. As the authorized operator, explicitly call `configure_payroll_first_month('YYYY-MM-01')`; do not choose a historical month implicitly.
5. Verify staff fixture sees its own month and cannot request another employee; verify inactive/no-workspace fixture is denied.
6. Verify an authorized payroll fixture sees active employees; unauthorized admin cannot settle.
7. Settle one employee/month once; repeat and retain the unique-conflict denial.
8. Attempt direct update/delete of the settlement and retain immutable-trigger denial.
9. Create an adjustment; verify original base snapshot is unchanged and actor/time are server-derived.
10. Confirm legacy attendance `total_salary` and any historical salary rows are byte-for-byte unchanged.
11. Only after every check passes, enable `PAYROLL_SETTLEMENT_ENABLED=true`, restart the application, and run targeted UI smoke tests.
12. Roll back runtime first on any authorization, duplicate, snapshot, or audit failure. SQL rollback is destructive and requires an export/approval.
