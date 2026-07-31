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
PR #100 (`b8a8bfb`) is merged. Earlier forward attempts rolled back safely and
no successful cancellation mutation is recorded.

1. Derive the current commands and filenames from the runbook and rerun its
   updated read-only pre-run. Retain `attendance-cancellation-pre-run.txt`.
2. Require all of the following: exact target count **1**; employee open-row
   count **1**; `total_hours` is `NULL` or exact zero; `total_salary` is `NULL`
   or exact zero; Payroll references **0**; actor authorization `PASS`; grant
   inventory exactly as documented.
3. **Stop for explicit mutation approval.** Do not weaken a predicate or change
   an ID to make the guard pass.
4. After approval, run the guarded forward exactly once. Expected affected
   target-row count: **1**; retain the forward transcript.
5. Run the package post-run and retain
   `attendance-cancellation-post-run.txt`.
6. Run package-wide validation and retain
   `attendance-cancellation-validation.txt`.
7. Retain the pre-run, approval, forward, post-run, validation, migration-history,
   authorization/RLS, and smoke evidence together without secrets or PII.
8. Perform Staff/Admin production smoke exactly as the runbook and production
   runtime-gate runbook specify.
9. Keep `ATTENDANCE_RECOVERY_ENABLED=false` or unset until every retained check
   passes. Flag enablement is a separate approval, not part of this package.

Stop on any predicate/count mismatch, non-zero legacy total, Payroll reference,
authorization/grant failure, unexpected affected-row count, missing immutable
audit evidence, normal Staff check-in/out regression, or Admin denial/bypass.
Rollback, only after separate approval, uses
`supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql` and the
retained cancellation audit ID.

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

### D. Remaining operator packages

Do not execute these as a batch. After B and C are closed with retained evidence,
re-read the roadmap, select only the first eligible package below, run its
read-only preflight, and stop before its first mutation:

1. **Employee salary configuration / Employee Profile extension —
   `BLOCKED_BY_BUSINESS_DECISION`.** No mutation is eligible until all eight
   profile field, permission, sensitive-data, audit, retention, and deletion
   decisions in the roadmap are approved.
2. **Ledger/Reimbursement — `READY_FOR_OPERATOR` / `LIVE_APPROVAL_REQUIRED`.**
   Use package `20260728153000`; keep `FINANCE_REIMBURSEMENT_ENABLED=false`.
3. **Payroll — `READY_FOR_OPERATOR`.** Depends on Attendance/Facility evidence;
   use `20260728100414`, require an explicit first official month, and keep
   `PAYROLL_SETTLEMENT_ENABLED=false`.
4. **ERP transactional email — `READY_FOR_OPERATOR` for one-recipient smoke.**
   Follow `docs/email-setup.md`, stop before the first live send, and keep
   `EMAIL_DELIVERY_ENABLED=false` until its smoke gate passes. Email-history
   governance remains business-decision-blocked.
5. **Facility and Dashboard production fixtures.** Facility is
   `LIVE_OPERATOR_VERIFICATION_REQUIRED`; Dashboard is read-only
   `READY_FOR_OPERATOR`. Never invent or insert fixture data. Retain empty,
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
4. the evidence file that will retain redacted output.

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
