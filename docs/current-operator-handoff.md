# Current Operator Handoff

**Prepared:** 2026-07-31
**Authority:** this is the exact local execution authority. Status is owned by
[the ERP implementation roadmap](ERP_IMPLEMENTATION_ROADMAP.md); package-specific
predicates and commands remain in their linked runbooks.
**Boundary:** no SQL/RPC was executed, no production row was inspected, no
runtime flag was changed, no deployment occurred, and no merge is authorized by
this handoff.

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

The next Attendance gate is production Staff/Admin smoke only. Perform that
smoke exactly as the runbook and production runtime-gate runbook specify, retain
the authorization/RLS and smoke evidence, and stop on any normal Staff
check-in/out regression, authorization failure, Admin denial/bypass, count
drift, or smoke failure.

Keep `ATTENDANCE_RECOVERY_ENABLED=false`. Do not replay the forward. Rollback is
not approved and remains separately approval-gated through
`supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql` using
retained audit event ID `1`.

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

1. **Employee salary configuration / Employee Profile extension —
   `BLOCKED_BY_BUSINESS_DECISION`.** No mutation is eligible until all eight
   profile field, permission, sensitive-data, audit, retention, and deletion
   decisions in the roadmap are approved.
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

**Current exact stop point:** documentation/PR review before merge. The first
local operator action after an approved documentation PR merge is section A
repository synchronization. The first potential production mutation is section
B step 4, and local Codex must stop at section B step 3 for explicit approval.
