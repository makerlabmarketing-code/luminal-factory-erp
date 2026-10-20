# Finance actor display and payroll recovery — 2026-10-20

Reported: staff reimbursement submitter appeared as transaction executor; accidental payroll closing could not be reopened; adjustment interaction was unclear.

Application repair: resolve actual approver and payment confirmer from stable employee FKs, never requester/payer text. Show each role under Người thực hiện; missing historical actors stay unknown. Add payroll close author/time. Replace prompt-based adjustment with accessible dialog, whole-VND validation, payable preview, bounded reason, visible history and server reload. Clarify closing versus payment. An uncertain network outcome blocks retry in that dialog until the user closes/reloads. Adjustment does not modify previously created ledger amounts or transfer money.

Prepared recovery: user chose reopening only before payment. Feature-gated API/dialog/history stays off under PAYROLL_REOPEN_ENABLED until exact draft SQL approved. Two new metadata/history tables preserve immutable old snapshots, allow new snapshot after reopening and guard one active snapshot per employee/month. SQL checks paid/unknown-identity salary records, existing adjustments, stale requests and unfinished shifts; attendance/payment guards protect reopen/close transitions. Details in specs/payroll-reopening-and-finance-actors.md and supabase/drafts/payroll-reopening/README.md.

Validation: 1,001 tests / 140 files; lint; TypeScript; production webpack build with nonsecret placeholder public config; isolated PGlite package tests, including unused and guarded populated rollback. Turbopack local build hit an environment persistence-cache failure, so canonical Turbopack build is additionally checked on Vercel preview. No production close/reopen/adjust/pay action was submitted. No multi-session concurrency test was performed.

Approval needed only for exact new forward.sql hash 78fd9df1a1ed8de09746595cf8122924f5895bceecaa17c1804074eb6397382f and subsequent activation. Do not run unrelated previous migrations. Existing production snapshots, employee attendance, ledger and payments are untouched by this application release.

Rollback: revert application PR to restore prior display/dialog; keep PAYROLL_REOPEN_ENABLED off. SQL rollback is guarded and refuses to discard populated reopening history; use forward fixes once recovery has been used.
