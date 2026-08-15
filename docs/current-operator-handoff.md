# Current Operator Handoff

## Employee Auth lifecycle delivery reconciliation (2026-08-03)

The previously prepared Employee Auth lifecycle change is already published on
protected `main` as merged PR #121, commit
`1da42638e765e14f84664d69b18cfb811c43f6c3` (`fix(employees): separate Auth
email account flows (#121)`). The original task commit `938bdfa` is not present
in this workspace, but the merged commit contains the complete bounded 14-file
Employee/Auth diff and is the current repository tip.

Production deployment could not be verified from this Codex Cloud environment:
the read-only `GET https://erp.luminalfactory.com/api/system/version` request was
blocked by the environment's outbound proxy with HTTP `403` before an
application response was returned. This is not production `PASS` evidence. An
operator must verify that `/api/system/version` reports the merged commit before
performing any separately approved manual Auth action. No invitation, password
reset, account linkage, permission assignment, Employee mutation, SQL, migration,
Supabase configuration change, or live-data mutation was performed.

## Employee Auth invitation diagnostic boundary (2026-08-03)

The `Maker Lab` Employee fixture already exists and must not be recreated. The
application repair separates **Gửi lời mời**, **Kết nối tài khoản hiện có**,
**Gửi lại lời mời**, and **Gửi link đặt lại mật khẩu**, returns an honest
Supabase-accepted/delivery-unknown result with a correlation ID, and prevents
same-client double submission. See
[employee-auth-email-workflow.md](employee-auth-email-workflow.md).

Production Auth and Employee mutations remain operator-only. A controlled manual
retry may occur only after deployment verification; retain the correlation ID and
inspect Supabase Auth/provider logs plus Site URL and redirect allowlist before
deciding whether to resend. Codex Cloud did not send an email or mutate the fixture.

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

## 2026-08-03 Staff entry and same-minute Attendance correction

The Maker Lab Employee/Auth fixture was provisioned successfully with Staff-only
workspace access, the verified active facility, and zero hourly rate. Production
Staff check-in/check-out and duplicate current-shift prevention succeeded. The
observed defects are bounded to shared login entry routing, finalized conversion
of a zero-minute completed row, and the completed-current-shift action state.

The application correction routes clean Staff requests to `/login`, preserves a
safe local Staff target, resolves the destination from server-owned workspace
access, dynamically derives one converted shift for a valid same-minute completed
row, and hides the check-in action when that current shift already exists. The
Admin Attendance gate remains read-only; recovery remains disabled. No SQL,
migration, row repair, RLS, Auth identity, Employee, permission, runtime flag, or
production data mutation is authorized by this package.

After protected-main deployment is confirmed through `/api/system/version`, run
only the manual incognito Staff/Admin display retest. Do not create another
Attendance row unless a new approved business date/shift is available. The
Attendance gate remains incomplete until that corrected production evidence is
retained.

## 2026-08-03 Staff profile logout delivery

The bounded Staff logout slice adds a visible **Đăng xuất** action and account
summary to **Cá Nhân**. It uses the shared local-device Supabase sign-out,
synchronously locks duplicate taps, shows progress, refreshes the auth router,
and replaces document history with the fixed `/login` destination. A failed
request remains on the profile and shows only controlled Vietnamese feedback plus
a generated support ID. Mobile bottom spacing includes the device safe area.

The authentication routing contract remains unchanged: Staff-only accounts route
to Staff, Admin-only accounts route to Admin, dual-workspace accounts retain the
Admin default, and only approved local return paths are accepted. The slice does
not change Attendance calculations or mutations. Maker Lab's completed shift
remains 16:18–16:18, zero raw minutes, one converted shift, with no Start action;
duplicate current-shift writes remain blocked, zero-rate pay remains zero,
Attendance recovery remains disabled, and Admin Attendance remains read-only.

After protected-main deployment is confirmed through `/api/system/version`, the
next boundary is `READY_FOR_STAFF_LOGOUT_LOGIN_RETEST`. The operator must perform
the documented manual logout/login and retained Attendance display check. Do not
automate authentication or create another Attendance row.

## 2026-08-04 Attendance multi-check and Admin mutation boundary

The next application slice preserves one aggregate Attendance row per active
Employee/date/shift. Repeated same-shift operations use the earliest check-in
and latest check-out, so breaks remain inside elapsed duration; conversion keeps
the approved 180/360-minute boundaries and one-shift minimum. Staff mutation
responses reconcile the returned row locally without a second full-page fetch.

Admin create/update/delete is separated from `ATTENDANCE_RECOVERY_ENABLED` and
requires `ADMIN_WORKSPACE`, `ATTENDANCE_VIEW`, `ATTENDANCE_MANAGE`, and an audited
atomic RPC. The original create-note relaxation is superseded by the later
wiring repair: create, update, and cancellation now require a trimmed reason of
at least 10 characters.
Delete is a reasoned cancellation, not a
silent hard delete. Both capabilities remain fail-closed behind server-only
gates until the reviewed RPC, active-row unique index, and operation-audit
table are verified in production.

Status: `LIVE_APPROVAL_REQUIRED`. Draft-only preflight, forward, validation, and
rollback SQL are in `supabase/drafts/20260804_attendance_multi_check_admin_mutations_*`.
Do not execute them, enable `ATTENDANCE_MULTI_CHECK_ENABLED` or
`ATTENDANCE_MANUAL_MUTATIONS_ENABLED`, repair existing rows, or run Attendance
smoke writes until duplicate-active-row preflight and migration/RPC approval
pass. Expected schema impact is one partial unique index, one RLS-protected
operation-audit table, and two server-authorized RPCs; no existing rows are
backfilled by the package.

## Shared table / Attendance local-loading retest (2026-08-04)

The current application slice is `READY_FOR_TABLE_LOCAL_LOADING_RETEST`. Review `shared-data-table-guidance.md` for the inventory and boundaries. Retest Staff initial history loading and month refresh without a card/shell reset, then verify check-in/out only updates the current aggregate card and local history. Retest Admin month/employee changes plus create/update/cancellation with the daily modal and selected date stable. Do not perform production Attendance mutations from Codex Cloud; any manual mutation remains separately operator-approved and runtime-gated. Recovery remains disabled. Employee, Projects/tasks, and Finance table migrations are not part of this PR.

### Admin manual-entry blocker follow-up

Status: `READY_FOR_OPERATOR_RETEST`. The empty production `shifts` result now
uses the existing Attendance resolver's default three-shift configuration while
still preferring configured database rows. Retest that the selector shows
`Ca Sáng`, `Ca Chiều`, and `Ca Tối`; a failed save preserves the modal and form;
and a confirmed save closes the modal while updating only the affected calendar
day and summaries. Also verify the selected month and Employee filter remain
unchanged and that `Đang tải dữ liệu chấm công...` does not replace the page.

Codex Cloud did not execute SQL, alter schema/RLS/runtime gates, call the live
mutation RPC, or mutate production Attendance. Payroll calculation and immutable
audit/RPC contracts are unchanged.

## 2026-08-04 Admin Attendance create/update/delete wiring repair

Status: `READY_FOR_ADMIN_ATTENDANCE_MUTATION_RETEST`. The manual-create form now
retains `employees.id` independently from the visible Employee selection and
sends that stable id in the JSON payload. The API accepts the numeric JSON id,
rejects display names, emails, and auth ids, and verifies the target Employee is
active and visible through the authenticated server client before the audited
RPC.

Update now detects dirty check-in/check-out values, validates its own reason,
focuses the reason field on failure, and patches only the returned row. Delete
requires its own reason and confirmation, uses the existing audited soft
cancellation RPC, and removes only the affected row after success. Legacy
`log-*` rows remain read-only but now explain that state. Create, update, and
delete use separate reason paths and row/action-scoped duplicate locks.

No SQL, migration, RLS, backfill, runtime-gate activation, production
Attendance mutation, or production query was performed. Recovery remains
disabled. Manual production retest is required after the branch is deployed
with the already-approved mutation gate and audited RPC available.

## 2026-08-05 Staff Attendance open-session shift transition

Status: `READY_FOR_STAFF_ATTENDANCE_SHIFT_TRANSITION_RETEST`.

An open afternoon Attendance remains active after the evening boundary. The
Staff page does not expose another Start action while any open row exists and
continues to show the original shift plus `Kết thúc ca`; it does not split the
duration or move the row to the later shift. The server rejects check-in when
any open Attendance exists, regardless of shift label, with a second guard after
GPS validation.

After a successful checkout, the page performs a non-blocking authoritative
refresh of the selected month. The current shift is reevaluated from server
data, so a completed afternoon row permits evening Start while an already
completed evening row remains blocked. Same-shift continuation and aggregation
remain unchanged, and the client submission lock still prevents duplicate
clicks.

No SQL, migration, backfill, RLS change, runtime activation, production query,
or production Attendance mutation was performed. Recovery remains disabled.

Manual retest: leave a Staff afternoon session open until evening, verify only
the afternoon active card and `Kết thúc ca` are visible, attempt a rejected
evening Start, check out the afternoon session, verify evening `Bắt đầu ca`
appears, refresh while an earlier session is open, and verify duplicate clicks
produce only one request.

## 2026-08-05 Project Membership Slice 0 baseline

Status: `OPERATOR_QUERY_REQUIRED` for live Project Membership schema/RLS and
runtime confirmation. The repository audit is complete on
`codex/project-membership-baseline`; Attendance remains out of scope.

Authority: `project_members.project_id` + `project_members.employee_id` + an
ACTIVE role row. The server derives the actor from the authenticated Employee.
The approved role codes are `PROJECT_OWNER`, `PROJECT_MANAGER`,
`CREATIVE_LEAD`, and `CONTRIBUTOR`; revoke is soft and historical. Admin global
view/manage requires the server-side workspace and permission checks. Project
Manager membership can manage members; Creative Lead and Contributor are
view-only at this boundary.

Known blockers for later slices:

- compatibility project creation can persist a project before its manager
  membership and return a warning;
- role replacement is two writes and needs an atomic mutation boundary;
- database uniqueness currently needs confirmation for one active role per
  Employee/project regardless of role code;
- membership audit lacks reason, correlation, and before/after event records;
- the legacy Staff task loader is not assignment-scoped through a server read
  model and must not be expanded in Project Detail Slice 0.

The exact read-only package is
`supabase/validation/20260805_project_membership_baseline_readonly.sql`.
Do not run production SQL, migrations, backfills, RLS changes, RPC deployment,
or live project/membership mutations automatically.

Manual next check after the operator returns the package output:

1. Confirm `public.project_members`, its Employee/project foreign keys, RLS,
   policies, grants, and the active-role unique index match the repository
   authority.
2. Confirm duplicate active Employee/project groups, active memberships for
   inactive Employees, projects without owners, and task assignments without
   active membership are all zero or explicitly reviewed.
3. Confirm `projects.project_code` exists, is non-blank and unique, and record
   the `create_project_atomic` function privilege state.

Paste the redacted result sets back with table names, counts, policy/index
definitions, function privilege booleans, and no tokens, cookies, connection
strings, Employee PII, or raw database secrets.

## 2026-08-11 Project Membership display completion

Status: `APPLICATION_COMPLETE`; no operator action is required for the UI batch.
The remaining Project Membership gate is still the existing production
owner/manager/contributor/read-only/cancelled-project evidence package.

Project Detail now renders the canonical server summary, including project code,
active role counts, and the missing-owner condition. Active members and revoked
history are separated, while initial loading, targeted background refresh,
stale-data failure, retry, and empty states remain local to the membership
section. Add, role-change, and revoke continue using the existing server
authorization/mutation boundaries and refresh only membership data afterward.

Validation: 49/49 focused Project Detail/Membership tests pass. Eight stale
static assertions were aligned with the already-merged server boundaries they
protect, so the full suite passes 734/734 tests. Lint, TypeScript, production
build, and whitespace validation pass.

No SQL, migration, RLS, RPC, backfill, runtime flag, production query, live data
mutation, Commerce change, or deployment was performed. Rollback requires only
reverting the application/test/document commit; there is no database rollback.

## 2026-08-12 Project Membership atomic delivery boundary

PR #171 is merged on protected `main` at
`ef379b0765c4aa180a043e5bac596c6f9e794414`. The production version endpoint
reports that exact commit and Vercel reports a successful deployment. This proves
application delivery only.

The read-only Supabase migration inventory does not yet list
`20260812090000_project_membership_atomic_mutations`. Keep
`PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED=false` or unset and do not execute
the RPC. Do not run direct production SQL from Codex Cloud as a substitute for
the configured GitHub Integration.

Exact next gate: confirm the canonical integration has delivered the migration,
then follow `docs/project-membership-atomic-mutations-handoff.md` in order for
validation, browser/RPC grants, RLS, immutable audit, non-production role and
guard fixtures, timeline pagination, and separate flag activation approval. Stop
on migration-history absence, validation drift, unexpected browser grants,
fixture failure, or integrity-count mismatch.

## 2026-08-12 Operational scroll-reveal continuation

Status: `APPLICATION_COMPLETE`; this UI-only batch needs no operator action.
Dashboard and Project Coordination reuse the existing one-shot `ScrollReveal`
foundation in two meaningful groups per page. The implementation keeps reduced
motion, loading/error/empty states, API behavior, permissions, and business rules
unchanged. See `docs/operational-scroll-reveal-handoff.md` for scope and rollback.

This completion does not advance the Project Membership production gate. Keep
the membership runtime flag false/unset until the separate migration-history,
validation, grants/RLS, fixture, audit and activation sequence passes.
## 2026-08-15 Task Assignment atomic create

Status: `READY_FOR_PROTECTED_REVIEW`; production remains
`LIVE_OPERATOR_VERIFICATION_REQUIRED`. Review
`docs/task-assignment-atomic-create-handoff.md` for the sole package-specific
sequence. Keep `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=false` or unset.

The protected migration, read-only pre/post validation, rollback, application
error mapping, and focused regression contract are complete. No Vercel deploy,
production SQL/RPC, runtime activation, RLS change, backfill, or live task write
was performed. The next action is protected review/PR delivery, not direct SQL.
After merge, confirm canonical GitHub Integration migration history, validate
invoker/search-path/service-role-only privileges, run only the approved
non-production fixture matrix, and request separate runtime-flag approval.
Stop on missing migration history, privilege drift, cross-project acceptance,
inactive/non-member assignment, authorization bypass, or any partial row.
