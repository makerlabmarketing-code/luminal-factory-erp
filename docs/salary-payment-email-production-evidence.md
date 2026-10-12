# E-010 · SQL Production · 12/10/2026

Owner approved the exact package: “duyệt r đó chạy thôi”. ERP project `kwfmfmpgpbfewpiizesv` was ACTIVE_HEALTHY; read-only preflight found no salary queue/RPC/template and verified deployed columns and service-role privileges.

PR #227 merged `1c01d5d`. Supabase Integration main reports RUNNING_MIGRATIONS with last update 22/07; the queue/RPC remained absent after merge. Used Supabase Migration API, the same execution route recorded for E-009, after the explicit execution approval. API returned success and recorded `20261012014055_salary_payment_email`. Align repository migration filename with this observed version to avoid replay when integration recovers. SQL SHA-256 remains `82db6197f37ce018a97eae4bad2fc31aea8cd8fbc7974375823812696198675e`; no changed SQL or second execution.

Postflight live: RLS enabled; anon/authenticated SELECT/INSERT/UPDATE/DELETE and RPC EXECUTE denied; service_role SELECT/INSERT/UPDATE/EXECUTE allowed. Service_role DELETE is inherited from project defaults; no application delete path exists, and browser deletion is denied. RPC is SECURITY INVOKER with explicit search_path; snapshot trigger enabled; one active SALARY_PAYMENT_CONFIRMED template; queue count 0. New Security Advisor WARN count 0; INFO RLS/no-policy is intentional server-only default denial. Existing security WARN findings remain outside this slice.

PGlite checks passed again for the exact SQL: atomic rollback, duplicate/conflict/denied rows, one claim, immutable snapshot, uncertain-send no retry and rollback preserving receipts. Application from #225/#226 already passed 955 tests/lint/TypeScript/build; this release changes SQL packaging/evidence only. Vercel #227 Production `dpl_9PB4M8qZWX9T6wAc57432hvjfCs8` READY.

SMTP_HOST/PORT/USER/PASS, EMAIL_DELIVERY_ENABLED and SALARY_PAYMENT_EMAIL_ENABLED remain absent in Production environment metadata. No credentials decrypted, no payroll/ledger data changed for smoke, no fixture created, no outbound email. SQL acceptance is complete; SMTP and authenticated provider/inbox smoke remain pending. Operator must enter credentials directly in Vercel and identify the controlled test recipient/fixture. Keep both gates off until those prerequisites are met.

Rollback: disable salary gate/redeploy, use packaged rollback to disable RPC and INSERT/UPDATE while keeping receipts and template; no payment reversal. Never reapply forward or delete receipts to resolve ambiguous SMTP outcomes.
