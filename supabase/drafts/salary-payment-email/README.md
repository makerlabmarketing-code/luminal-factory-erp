# E-010 · Salary payment email rollout

Application scope approved by the owner: Sổ thu chi → Đã trả → email to the employee beneficiary. Settlement is a separate amount-finalization step. Application delivery/merge is allowed; the production SQL and automatic email activation remain separate gates.

## Production approval · 12/10/2026

Owner approved the exact SQL package with “duyệt r đó chạy thôi”. The unchanged forward SQL is promoted to `supabase/migrations/20261012014055_salary_payment_email.sql` for protected-main delivery. GitHub Integration main remains RUNNING_MIGRATIONS with its last update in July; after #227 merged, Migration API applied the exact approved SQL. Repository version is aligned with the API-recorded version to prevent replay. Preflight: ERP ACTIVE_HEALTHY, queue/RPC absent, no salary template, deployed columns and service-role grants match. SHA-256 remains the exact approved value below; PGlite checks pass. Application #225/#226 is already Production READY; 955 tests pass.

Production still has no SMTP_HOST/PORT/USER/PASS or EMAIL_DELIVERY_ENABLED. SQL approval is recorded; outbound email remains disabled until operator configures SMTP and a controlled recipient/fixture is identified. Do not use real salary entries as test fixtures. Postflight passed: RLS enabled; anon/authenticated denied table access and RPC execution; service_role can select/insert/update/execute; invoker and enabled snapshot trigger; one active salary template; empty notification queue. Service-role DELETE is inherited from project defaults, while browser DELETE remains denied. No new Security Advisor WARN; RLS/no-policy INFO is expected for server-only access. Production evidence is in docs/salary-payment-email-production-evidence.md and coordination sheet E-010. Do not claim inbox delivery from SQL success.

## Findings verified read-only

- ERP Production at audit: `46a073bea6bb2ae5d448d5f40657c56050c8c078`, deployment `dpl_HUX72DunYAN6BHkgFtYjMMiX4a1W`, READY.
- No payroll notification caller, no salary template, no payroll settlements. Existing salary ledger rows #105/#106 have a beneficiary and email.
- Their category says T.6 while ledger period is 07/2026. The new payment prompt requires the explicit salary month; no inference or backfill.
- Production environment metadata contains no `EMAIL_DELIVERY_ENABLED` or SMTP variables. Secret values were neither decrypted nor printed.
- `email_history` has no `error_message`; sending code incorrectly included it. Fixed the insert shape and use the privileged server client behind existing caller authorization; a history failure never turns SMTP acceptance into a failed send.
- Read-only preflight confirms service_role employee/template/history/ledger and sequence privileges needed by the invoker RPC.

## Exact SQL approval scope

ERP project `kwfmfmpgpbfewpiizesv`. Forward SHA-256:
`82db6197f37ce018a97eae4bad2fc31aea8cd8fbc7974375823812696198675e`.

Adds one `salary_payment_emails` table, unique ledger receipt, ledger/employee/actor FKs, RLS and service-role-only access; two invoker functions, one snapshot guard trigger; one Vietnamese salary template if absent. It does not alter existing ledger/payroll schemas, existing templates, RLS policies, attendance or salary calculations. No backfill or historical email.

Only dedicated confirmation changes an unpaid individual salary expense to PAID, stores date/actor, and writes one immutable amount/person/month snapshot in the same transaction. Existing activity capture records the authenticated actor. Missing email or provider configuration blocks the notification, preserving the payment. Generic create/edit cannot mark a salary paid while the salary gate is enabled.

Classification intentionally supports expense types CHI_TIEU/CHI_PHI, structured source SALARY/PAYROLL, or legacy categories beginning with `Lương`. Aggregate categories such as `Thanh toán lương nhiều nhân sự` are excluded: split/identify beneficiaries before individual notifications. Existing paid entries never generate retroactive receipts.

## Reliability and limits

PENDING/BLOCKED → one atomic SENDING claim → ACCEPTED or UNKNOWN. Only attempts that have not contacted SMTP can be retried from the admin action. A timeout after SMTP DATA is ambiguous; no automatic retry. Process interruption in SENDING also requires provider reconciliation, not a resend. This avoids duplicate attempts but cannot prove exactly-once inbox delivery over SMTP. ACCEPTED means provider acceptance, not inbox receipt. No webhook, background cron or automatic mass retry is added.

SMTP enforces one recipient, HTML escaping, TLS and bounded timeouts. The receipt records provider message ID and independent history persistence. Snapshot fields cannot change; recipient may be repaired from the same employee profile only before a send attempt. No email addresses/salary amounts are logged to console.

## Rollout after approval

1. Confirm `SALARY_PAYMENT_EMAIL_ENABLED` and `EMAIL_DELIVERY_ENABLED` remain absent/false.
2. Run `preflight.sql`, compare exact package hash, apply approved `forward.sql`, run `validation.sql` (RLS true; anon/authenticated denied; service_role allowed; invoker; one active template; queue empty).
3. Operator enters server-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM_NAME` in Vercel Production. Do not paste secrets in chat, Git or sheet. Use the operator's existing provider; no provider switch/cost is assumed.
4. Approve an exact controlled test recipient and disposable unpaid salary fixture. Enable `EMAIL_DELIVERY_ENABLED=true`, `SALARY_PAYMENT_EMAIL_ENABLED=true`, redeploy, then perform bounded authenticated smoke: month, amount, employee, date, receipt, email history and provider/inbox evidence. Do not change real wages merely to test.
5. Check concurrent duplicate confirmation, provider-disabled failure, snapshot and row ownership/permissions; restore fixture per the approved cleanup. Only after these checks mark E-010 live accepted.

No SQL, flags, credentials, real salary payment or outbound email was changed by preparation.

## Validation

- 954 Vitest tests; SMTP/runtime tests mock transport and never send mail.
- ESLint, TypeScript, production build (fake public Supabase build-only values), diff check.
- PGlite PostgreSQL: atomic rollback on queue failure; same receipt on retry; different-month conflict; old-paid/counter/missing-beneficiary deny; one SMTP claim; snapshot/ambiguous-attempt guards; public denial; rollback preserves receipts.
- Native browser and real SMTP/inbox smoke remain blocked on the SQL/configuration/test-recipient gates.

Run SQL validation locally with an installed `@electric-sql/pglite@0.3.14`:
`PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node supabase/drafts/salary-payment-email/test.mjs`.

Rollback: disable salary gate and redeploy first, run `rollback.sql`. It disables the RPC and writes but preserves receipt history and template; it never reverses confirmed salary payments. Do not drop the table or delete receipts to work around ambiguous mail outcomes.
