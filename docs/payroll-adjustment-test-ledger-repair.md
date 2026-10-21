# Payroll adjusted reopening and disposable reimbursement repair

Trigger: adjusted unpaid payroll could not reopen; paid test reimbursement #115 could not be removed from the ledger.

The new payroll result counts each immutable adjustment once across all snapshots of the employee/month. Opening and reclosing retains the original adjustment IDs and amounts. Stale snapshots, paid salary, permissions, and attendance locks remain guarded.

Paid reimbursement correction submits evidence fields only. Frozen people/actors and workflow state remain stored in the database. No production edit was used to reproduce or validate a real record.

Owner-only test removal uses `cancelled_at`, explicit disposable-data confirmation, typed record ID and reason. It supports restoration in the “Xem bản ghi đã xóa” view, excludes cancelled records from financial totals and charts, retains payment evidence and creates atomic audit history. Only standalone reimbursements can use it. It does not refund money. Staff reimbursement history remains retained.

Delivery: apply migration `20261021032722_payroll_adjustments_and_test_ledger.sql`, verify grants and counts, then enable production `FINANCE_TEST_ARCHIVE_ENABLED=true` and redeploy. Reopening is already enabled. Do not turn on test archive before the SQL package is installed. No test records are automatically deleted.

Rollback: disable test archive first; restore any archived test entries through the UI before dropping its RPC. The correction function keeps its archived-record guard. Payroll rollback refuses when an adjusted snapshot has been reopened: a forward fix is required to preserve carried payable amounts. Existing payroll reopening flag can be disabled independently.

Validation: full Vitest suite, lint, TypeScript, production webpack build with nonsecret placeholder public envs; PGlite 0.3.14 fixtures for adjustment continuity/reclose/immutability/paid/stale/permission guards and test archive/restore/audit/idempotency/role grants. No real concurrent-session or production business mutation is claimed.

SQL SHA256: 16accee71f49713de9ca7a3a553d774e9749bfa066d3b96cddf575b91e662459
