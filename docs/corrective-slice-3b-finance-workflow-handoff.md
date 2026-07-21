# Corrective Slice 3B Finance Workflow Handoff

Date: 2026-07-21

## Scope completed

Application-only corrective slice for finance role semantics and expense workflow preparation.

- Added a typed finance expense workflow contract separating Beneficiary, Payer / payment executor, Record creator, Reimbursement requester, Reimbursement recipient, Approver, and Payment confirmer.
- Added category-aware validation for salary, reimbursement, supplier payment, and existing approved expense families.
- Added deterministic beneficiary VietQR generation from the beneficiary employee payment profile and the Vietnamese missing-payment warning: `Nhân sự chưa có thông tin nhận tiền.`
- Added receipt/attachment validation for image/PDF type, 10 MB maximum size, and safe filenames.
- Added reimbursement status transition validation for DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID, and CANCELLED; rejection requires a reason; requester self-approval/self-payment confirmation is blocked.
- Redesigned the current finance add/edit dialog into sections: `Thông tin khoản chi`, `Người liên quan`, `Thanh toán`, `Chứng từ`, and `Phê duyệt và lịch sử`.
- Preserved existing schema and current `financial_ledger` compatibility behavior; no SQL was executed.

## Compatibility behavior

The current live `financial_ledger` records still expose only legacy fields such as `requested_by`, `type`, `category`, `amount`, `bill_url`, `is_paid`, and `month_period`. The application treats `requested_by` as a legacy display fallback only until the reviewed finance schema is approved.

Backfill classification plan:

- Salary rows with a deterministic employee match may backfill `beneficiary_employee_id` only when the legacy person string matches exactly one active employee.
- Self-paid/advance/reimbursement rows may backfill requester/recipient only when the legacy person string matches exactly one active employee and the transaction type/category is unambiguous.
- Supplier or external rows must keep external beneficiary text unless an approved supplier record exists.
- Ambiguous rows must be written to a conflict report and must not be guessed.

## Approval gate

`LIVE_APPROVAL_REQUIRED` before any schema change, RLS change, storage bucket/policy change, transactional RPC, permission backfill, finance backfill, or live data mutation.
