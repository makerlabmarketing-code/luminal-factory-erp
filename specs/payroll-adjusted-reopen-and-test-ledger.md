# Mở lại lương có điều chỉnh và xóa mềm phiếu thử

Reported scope: reopen unpaid adjusted payroll and edit/remove the disposable test reimbursement #115.

- Approved adjustments remain immutable and continue to count once per employee/month while open and after every reclose. No cloning, reassigning, or automatic cancellation of adjustments. Paid salary blockers and stale snapshot guards remain.
- Paid reimbursement corrections preserve requester, beneficiary, payer, approver and payment confirmer. Only category, amount, period, date, description and project can change, with a reason.
- The deletion UI requires the administrator to explicitly identify the record as disposable test data, confirm its ID, and give a reason. Archive is reversible through the same UI and excludes the record from ledger totals. Keep payment evidence and audit history. Never infer disposable status from the word test.
- Limit test archive to standalone reimbursements with no source integration or linked counter rows; salary and integrated transactions stay protected. Server requires FINANCE_UPDATE and owner authority; feature defaults off. SQL RPC is service-role only, records server-derived actor and reason in the same transaction.
- No live record is changed by QA. SQL rollout requires review of the complete package.

Validation: adjusted reopen/reclose repeats, unchanged adjustment IDs/counts, paid/stale/permission blockers, paid reimbursement correction with inactive staff, archive/restore totals and repeat requests, RPC role grants. Rollback disables feature first and restores previous payroll functions only before an adjusted reopening has occurred; otherwise forward-fix to preserve payable amounts.
