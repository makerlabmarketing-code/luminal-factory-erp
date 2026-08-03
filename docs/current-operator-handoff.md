# Current Operator Handoff

**Prepared:** 2026-08-03
**Authority:** this is the exact local execution authority. Status is owned by
[the ERP implementation roadmap](ERP_IMPLEMENTATION_ROADMAP.md); package-specific
predicates and commands remain in their linked runbooks.
**Boundary:** no SQL/RPC was executed, no production row was inspected, no
runtime flag was changed, and no manual deployment occurred. The production
runtime evidence below was collected through read-only endpoints; any automatic
Vercel deployment after protected-main merge is observed, not manually
controlled.

## Employee create diagnostic retry boundary (2026-08-03)

The read-only production metadata inspection is now complete. It proved the
root cause: `employees.qr_token` is `NOT NULL`, has no default, was absent from
the application insert, and caused PostgreSQL `23502` at `employee_insert`.
Tracked/live schema evidence identifies `employees_qr_token_key` as unique, and
no trigger was found that supplies the value before constraint enforcement.

The application-only repair generates a UUID v4 server-side after Admin
authentication/authorization, includes it in the insert, never accepts or
returns it through the create API, and bounds a proven QR-token uniqueness
collision to three server insert attempts. No schema change is required. Do not
retry production Employee creation until the repaired commit is deployed and
verified through `/api/system/version`. After deployment, perform exactly one
manual Admin retry; do not automate it. Attendance fixture provisioning remains
incomplete until that retry proves success and returns the created Employee ID.

PR #117's 15-minute, 100-entry lookup was deployment-local and therefore could
not be authoritative across Vercel instances. The application-only repair
removes both that map and `GET /api/admin/employees/diagnostics/<correlationId>`.
Safe diagnostics now arrive in the same POST failure response, only after server
authorization confirms `ADMIN_WORKSPACE` and `EMPLOYEE_MANAGE`. There is no
shared diagnostic persistence and no production mutation is needed to make the
diagnostic available.

The reviewed metadata evidence supersedes the former preflight gate. Do not retry
before the application repair is deployed. The later separately approved Admin
retry must use one known test-only payload, submit exactly once, preserve the dialog
state, and capture only: timestamp/timezone, HTTP status, `success`, `code`, `failureStage`, safe
Vietnamese `message`, `fieldErrors`, `diagnostic.available`,
`diagnostic.operationStage`, `diagnostic.databaseCode`, `diagnostic.table`,
`diagnostic.column`, `diagnostic.constraint`, `diagnostic.rowReturned`,
`diagnostic.readbackAttempted`, `diagnostic.resultUncertain`,
`diagnostic.category`, and `correlationId`. Never
capture the request body, cookies, headers, tokens, raw errors, or environment.
If the result is uncertain, search by the exact normalized email before requesting
approval for any further attempt. Do not mark Employee creation fixed until a
production create and returned ID are proven.

## Tonight's ordered execution sequence

Execute only the first incomplete gate. A `PASS` requires retained evidence; a
prepared or merged package is not production `PASS`. Before every command record
whether it is read-only or mutating, its expected affected-row count, stop
conditions, and evidence filename. Stop for explicit approval before each
package's first mutation.

### A. Repository synchronization

1. `git switch main`.
2. `git pull origin main`.
3. Confirm `git rev-parse main` equals `git rev-parse origin/main`.
4. Confirm `git status --short` is empty.
5. Confirm the expected Supabase project link and inspect migration history;
   never replay an already-recorded migration. Attendance cancellation is
   `20260730024246`; Attendance recovery RLS is the distinct
   `20260715073600` migration.
6. Confirm `psql`, `gh`, and the runbook-required environment variable *names*
   are available without printing values. Never echo or retain credentials,
   database URLs, tokens, or PII.

Stop here on branch/ref mismatch, a dirty worktree, unexpected migration drift,
wrong Supabase link, missing tools, or missing required environment. Repository
synchronization is read-only with expected affected-row count zero. Retain a
redacted synchronization transcript.

### B. Attendance stale-row cancellation

Authority: [Attendance stale-row audited cancellation operator runbook](attendance-stale-row-cancellation-operator-runbook.md).
PR #100 (`b8a8bfb`) is merged. The approved production correction is complete:
the guarded forward committed exactly once, the post-run passed, and the
package-wide read-only validation passed. Exactly one Attendance row is
cancelled and immutable cancellation audit event ID `1` is retained.

Retained evidence:

- forward: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-forward.txt`
- post-run: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-post-run.txt`
- package validation: `C:\Users\tungd\AppData\Local\Temp\attendance-cancellation-validation.txt`

Verified state: employee open-row count **0**; `check_out`, `total_hours`, and
`total_salary` are `NULL`; finalized Payroll references **0**; duplicate state
count **0**; audit event ID `1` is unique and protected by the immutable trigger
and current grants.

The next Attendance gate is dedicated test-fixture provisioning approval,
followed by production Staff/Admin smoke. Perform those steps exactly as the
runbook and production runtime-gate runbook specify, retain the
authorization/RLS and smoke evidence, and stop on any normal Staff
check-in/out regression, authorization failure, Admin denial/bypass, count
drift, or smoke failure.

Keep `ATTENDANCE_RECOVERY_ENABLED=false`. Do not replay the forward. Rollback is
not approved and remains separately approval-gated through
`supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql` using
retained audit event ID `1`.

#### Dedicated Attendance smoke fixture preparation

The approved interim policy permits one unmistakably test-only active employee to
remain payroll-visible only when `hourly_rate=0`; its completed Attendance evidence
row may remain, but it must never be settled, adjusted, reimbursed, assigned real
work, or reused as a real employee. Employee Detail → **Tài chính cá nhân** now
supports an `EMPLOYEE_MANAGE` + `FINANCE_VIEW` hourly-rate PATCH through the existing
server route. Zero is preserved, negative/invalid/over-precision/out-of-range values
fail before persistence, and Payroll calculation remains unchanged.

Production fixture creation is still a separate approval boundary. Before creating
or inviting the fixture, the operator must provide a controlled test email, select an
existing active facility with verified GPS/radius, set and read back the rate as zero,
grant only `STAFF_WORKSPACE`, and retain evidence that the account has no project,
reimbursement, pre-existing Attendance, or settlement participation. The later
approved smoke-test row is the sole Attendance exception and remains as retained
operator evidence. No fixture was provisioned by the application slice.

#### Deployment and runtime verification boundary

The runbook-verification slice is now implemented on `main`, and its production
evidence is recorded. The authoritative alias is
`https://erp.luminalfactory.com`; the Vercel URL is supporting metadata only.
On 2026-08-01 (+07:00), `GET /api/system/version` returned
`status=available`, `deploymentEnvironment=production`, and approved commit
`e2090766cd6d9193f43ed2006657859b9251647e`. In the same existing authenticated
Admin browser session with `ADMIN_WORKSPACE` and `ATTENDANCE_VIEW`,
`GET /api/admin/runtime/attendance-recovery` returned
`gate=ATTENDANCE_RECOVERY_ENABLED` and normalized `status=disabled` with safe
correlation ID `bc763507-2dbb-4598-b89f-5f7f8a951429`.

Both routes are read-only and no-store. No fixture was provisioned and no
Attendance check-in/check-out smoke has occurred. The next boundary is
`READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`. Follow section 0 of the
[production runtime runbook](production-runtime-gate-operator-runbook.md) for
the exact response contracts, evidence fields, and timestamp format.

### C. Finance linked-ledger atomic edit

Authority: [linked finance ledger edit atomicity package](finance-linked-ledger-atomic-edit-operator-package.md).
PR #103 (`e82b873`) is on `main`; its compensation-safe browser fix does not
provide true database atomicity. The `SECURITY INVOKER` RPC package is prepared
but not executed.

Proceed only after section B has retained its outcome and the finance PR/package
is confirmed on synchronized `main`:

1. Run the package's read-only pre-run and retain its output. Expected row
   mutation count: zero.
2. Verify required tables/columns, RLS, policies, ownership, grants, and expected
   function absence/presence. Existing authenticated ledger access must be
   exactly intended; do not broaden policies for the function.
3. Stop before forward if any invariant fails. Otherwise **stop for explicit
   mutation approval**.
4. Apply only the approved `SECURITY INVOKER` RPC in one approved window. The DDL
   changes the function definition/grants and is expected to mutate zero
   business rows.
5. Run validation and retain output.
6. Verify authenticated-only `EXECUTE`, `security_definer = false`, and existing
   ledger RLS behavior.
7. Wire/use the RPC only after validation, then verify CREATE, UPDATE, CANCEL,
   and NONE using the package's disposable test boundary.
8. Force a dependent failure and prove zero partial persistence.
9. Retain pre-run, approval, forward, validation, grants/RLS, functional,
   forced-failure, and rollback-ready evidence.

Stop on invariant/validation failure, broader execution access, RLS regression,
unexpected production-row mutation, or any partial persistence. Before
application activation, rollback is
`supabase/drafts/20260731_finance_linked_ledger_edit_rollback.sql`.

#### Local Admin ledger application remediation

The uncommitted local task branch contains a bounded Admin ledger repair. Browser
mutations are replaced by a server-owned finance-permission boundary; executor
and beneficiary render independently; beneficiary QR uses the stable beneficiary
employee ID; legacy rows without a reliable beneficiary show `Chưa xác định`;
and document operations are prepared behind the still-disabled reimbursement
gate plus `FINANCE_ATTACHMENT_WRITES_ENABLED=false`. The server refuses extended
schema activation when schema readiness is missing and refuses attachment access
until the private bucket configuration is verified. Linked-row edits also fail
closed until the approved atomic RPC is active; ordinary one-row edits remain
available. Final local validation passes: lint, TypeScript, all 71 test files /
566 tests, and the production build.

This does not close section C or activate Ledger/Reimbursement. Keep
`FINANCE_REIMBURSEMENT_ENABLED=false` and
`FINANCE_ATTACHMENT_WRITES_ENABLED=false`. The private bucket package is draft-only:

- forward: `supabase/drafts/20260801_finance_evidence_storage_forward.sql`
- rollback: `supabase/drafts/20260801_finance_evidence_storage_rollback.sql`
- validation: `supabase/validation/20260801_finance_evidence_storage_validation.sql`

Do not execute, promote, or enable it without the existing Ledger/Reimbursement
preflight and explicit live approval. Do not enable attachment writes until a
database-atomic active-count invariant and authenticated concurrency/cleanup
smoke have also passed. Existing `bill_url` values remain
render-only compatibility. No legacy salary row is backfilled or inferred.

### D. Remaining operator packages

Do not execute these as a batch. After B and C are closed with retained evidence,
re-read the roadmap, select only the first eligible package below, run its
read-only preflight, and stop before its first mutation:

1. **Employee Profile extension — `BLOCKED_BY_BUSINESS_DECISION`.** The existing
   `hourly_rate` field is not part of this schema extension and has its bounded
   permission-aware Employee Detail editor. The eight proposed profile field,
   sensitive-data, audit, retention, and deletion decisions remain unresolved.
2. **Ledger/Reimbursement — `READY_FOR_LOCAL_OPERATOR`.**
   Use package `20260728153000`; keep `FINANCE_REIMBURSEMENT_ENABLED=false`.
3. **Payroll — `READY_FOR_LOCAL_OPERATOR`.** Depends on Attendance/Facility evidence;
   use `20260728100414`, require an explicit first official month, and keep
   `PAYROLL_SETTLEMENT_ENABLED=false`.
4. **ERP transactional email — `BLOCKED_BY_DEPENDENCY` for live delivery.**
   After protected review and explicit configuration/smoke approval, follow
   `docs/email-setup.md`, stop before the first live send, and keep
   `EMAIL_DELIVERY_ENABLED=false` until its one-recipient smoke gate passes.
   Email-history safe UI/read work is `READY_FOR_PROTECTED_REVIEW`; its
   schema/RLS/archive/retry work is `BLOCKED_BY_BUSINESS_DECISION`.
5. **Facility and Dashboard production fixtures.** Facility is
   `READY_FOR_LOCAL_OPERATOR`; Dashboard is read-only
   `READY_FOR_LOCAL_OPERATOR`. Never invent or insert fixture data. Retain empty,
   populated, denied, and error/retry evidence only after source dependencies
   pass; keep `FACILITY_ACTIVE_STATE_ENABLED=false` until its gate passes.

Phase Templates are not in the mutation queue. They remain
`BLOCKED_BY_BUSINESS_DECISION` until the exact twelve decisions in
`docs/phase-template-business-decision.md` are answered.

## Exact Local Codex CLI Master Prompt

Copy the prompt below into local VS Code/Codex CLI:

```text
Continue from the synchronized local repository state as a production operator assistant.

First read docs/ERP_IMPLEMENTATION_ROADMAP.md (the sole status authority) and docs/current-operator-handoff.md (the exact execution authority). Then read only the package-specific runbook linked for the first incomplete eligible gate. Derive current filenames, variables, commands, predicates, migration IDs, evidence names, and rollback commands from those repository runbooks; do not substitute remembered or hardcoded assumptions.

Verify the repository, main/origin-main equality, clean worktree, Supabase link, migration history, required tools, and required environment-variable names without printing secret values. Never replay a migration already recorded in migration history.

Execute only the first incomplete operator gate. Before every command, state:
1. READ-ONLY or MUTATING;
2. expected affected-row count (use zero for read-only/DDL business-row effects where the runbook says so);
3. exact stop conditions;
4. the evidence file that will retain redacted output;
5. the rollback boundary and rollback reference.

Run read-only preflight first. Stop before the package's first mutation and request explicit approval. After explicit approval, execute only that one approved package exactly once, then run its post-run, package validation, authorization/RLS checks, and documented smoke checks. Never skip ahead to another mutating package and never treat repository presence, a merged PR, or a successful preflight as production PASS.

Update docs/ERP_IMPLEMENTATION_ROADMAP.md and docs/current-operator-handoff.md only with the retained evidence outcome, redacted evidence filenames, and exact next gate. Do not expose credentials, tokens, password-bearing URLs, connection strings, secrets, or PII. Do not inspect unrelated production rows. Do not enable any runtime flag until that package's documented post-run, authorization/RLS, and smoke gate passes and separate flag approval is explicit. Do not deploy, merge, or automatically execute another package.

If any invariant, expected count, authorization/RLS check, migration-history check, or smoke check fails, stop, leave the runtime flag false/unset, preserve evidence, and report the package rollback reference without running rollback unless rollback itself is explicitly approved.
```

## Evidence update contract and exact stop point

After one package finishes or stops, record only redacted evidence filenames,
PASS/FAIL, affected-row counts, migration-history result, smoke result, and the
next gate in both authorities. Package details stay in their runbooks; do not
copy a competing command sequence into the roadmap.

**Current exact stop point:** `READY_FOR_TEST_FIXTURE_PROVISIONING_APPROVAL`.
The first local operator action is section A repository synchronization followed
by the two read-only verification requests in section 0. Fixture creation,
invitation, workspace/facility assignment, and hourly-rate persistence remain
separately approved application mutations. Attendance check-in/check-out remains
a later approval boundary.

## Employee create production-schema preflight boundary (2026-08-03)

Status: `LIVE_APPROVAL_REQUIRED`. The original Employee base-table DDL is not
tracked, so do not perform another Employee create yet. Approve and run only the
read-only metadata package:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/drafts/20260803_employee_create_schema_preflight.sql \
  | tee /tmp/employee-create-schema-preflight.txt
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/validation/20260803_employee_create_schema_preflight_validation.sql \
  | tee /tmp/employee-create-schema-preflight-validation.txt
```

Supabase SQL Editor may run each file verbatim instead. Expected row and schema
impact are both zero. Verify the transaction reports read-only, both files end in
`ROLLBACK`, all nine insert columns exist, no unsupplied non-null/no-default column
is present, the fixture branch code exists, the fixture email is not duplicated,
and constraints/triggers/RLS/policies/grants match the intended Admin insert and
select boundary. Redact employee/Auth rows, identifiers, and policy expressions
that reveal sensitive internal structure before sharing evidence. Stop on any
`FAIL`, `REVIEW_REQUIRED`, duplicate, missing relation/column, denied metadata, or
unexpected output. There is no forward or rollback schema script until the exact
defect is proven from this evidence.
