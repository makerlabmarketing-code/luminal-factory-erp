# Current Operator Handoff

**Prepared:** 2026-07-29

**Branch:** `work`

**Boundary:** repository delivery only. This handoff did not execute SQL/RPC, enable a runtime flag, deploy, or merge.

## Repository package verification

## Employee Profile persistence closure

`EMPLOYEE_PROFILE_PERSISTENCE_PASS`: the operator verified authenticated production Admin and Staff updates, navigation and hard-refresh readback, Admin partial-field preservation, Staff own-row targeting, and active-workspace notification isolation. `public.employees` is the authoritative employee profile source for both workspaces. Both workspaces now share that persistence/readback contract; Staff writes remain limited to phone, bank name, and bank account number, while mutation success remains separate from optional enrichment/readback warnings. The incident is **CLOSED**. No SQL, RLS broadening, or runtime flag change was required.

The exact next incomplete roadmap item is **Item 16, Gate 2 — Attendance recovery operator evidence**. Attendance application work is `APPLICATION_COMPLETE`, repository validation is `PASS`, and live Gate 2 is `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`. `ATTENDANCE_RECOVERY_ENABLED` is false/unset and live PASS requires retained operator evidence.

Attendance repository-safe review is complete. Normal Staff check-in/check-out has no recovery-flag dependency and retains authenticated own-row targeting. The package review covered pre-run, tracked forward, post-run, rollback, RLS, authorization, and smoke artifacts. Pre-run coverage now includes `shifts` and `current_employee_id()`; post-run coverage emits helper availability and a checkable zero-row missing-policy result; focused static regression protects these boundaries. No production SQL or runtime activation was performed, and no live Attendance PASS is claimed.

## Attendance Gate 2 — remaining operator actions

Execute and retain evidence in this order:

1. Verify production migration history. Never replay `20260715073600_attendance_recovery_rls.sql` when it is already recorded.
2. Run the registered Attendance Gate 2 read-only pre-run and retain its output.
3. Run and retain the registered post-run validation evidence against the verified live state.
4. Perform authenticated production authorization and smoke checks for Staff own-row access, Staff cross-employee denial, Admin view-only denial, authorized `ATTENDANCE_MANAGE` recovery, and disconnected/inactive denial.
5. Keep `ATTENDANCE_RECOVERY_ENABLED=false` until all pre-run, post-run, authorization, RLS, and smoke evidence passes.

There is no further Attendance implementation task unless a concrete repository defect is discovered. After unsafe/operator-only items are skipped, no approved safe Cloud roadmap item remains: Items 12–13 await operator delivery, Item 16 is operator-only, and Items 17–19 remain approval- or dependency-blocked. The next business-only action is review of the [Phase Template decision package](phase-template-business-decision.md); Phase Template implementation and the SaaS UI foundation remain prohibited pending separate approvals.


The branch contains the completed application slices and focused tests recorded in the [implementation roadmap](ERP_IMPLEMENTATION_ROADMAP.md). The seven production runtime gates have complete pre-run, forward, post-run/validation, rollback, authorization/RLS, regression, disabled-state, and smoke-test coverage according to the [activation matrix](runtime-gate-activation-matrix.md). The exact operator commands and stop conditions remain owned by the [production runbook](production-runtime-gate-operator-runbook.md); the ordered SQL/RPC register remains owned by the [SQL handoff](production-operator-sql-handoff.md).

Repository validation completed for this handoff:

- `npm test`: PASS — 62 files and 494 tests.
- `npm run lint`: PASS with three pre-existing warnings (`next/image` and two hook-dependency warnings).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS with the recorded lint, Edge Runtime, webpack cache, and Node 20 deprecation warnings.
- `git diff --check`: PASS.

## Operator gate order

Use the runbook's serial evidence order. Do not proceed to a dependent gate until its prerequisite evidence is retained as PASS:

1. Facility active-state compatibility and verification.
2. Attendance recovery after Facility PASS.
3. Phase Workflow foundation (an independent root from Facility/Attendance).
4. Phase status mutation after foundation PASS.
5. Task comments/activity after foundation PASS.
6. Project atomic create after comments/activity PASS.
7. Task atomic create after comments/activity PASS.

Phase status and comments/activity are dependency siblings after the foundation. Project atomic create and task atomic create are dependency siblings after comments/activity; the serial ordering exists only to simplify evidence capture.

## Runtime flags remaining disabled

Keep these server-only flags false or unset until the corresponding package, authorization/RLS checks, disabled and enabled smoke tests, and observation window pass:

- `FINANCE_REIMBURSEMENT_ENABLED`
- `FACILITY_ACTIVE_STATE_ENABLED`
- `ATTENDANCE_RECOVERY_ENABLED`
- `PHASE_WORKFLOW_FOUNDATION_ENABLED`
- `PHASE_STATUS_MUTATION_ENABLED`
- `TASK_COMMENTS_ACTIVITY_ENABLED`
- `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`
- `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`
- `PAYROLL_SETTLEMENT_ENABLED`

## Package decision status

Ledger/Reimbursement and Payroll business contracts are approved and both repository packages are `READY_FOR_OPERATOR`. This does not authorize SQL execution or runtime activation. Ledger/Reimbursement still requires protected migration delivery, private Storage/RLS review, post-run authorization and smoke evidence. Payroll still requires protected migration delivery, explicit first official settlement month, post-run authorization/RLS evidence, and smoke tests.

## Production smoke-test checklist

For each approved gate, retain the pre-run output, confirm migration history before applying any tracked migration, apply through exactly one approved workflow, require post-run PASS, exercise both authorized and denied fixtures, monitor the affected routes/RPCs, and disable the flag before rollback. The minimum journey checks are:

- Facility: directory read, legacy code/name resolution, active/inactive behavior, and browser-write denial.
- Attendance: normal Staff access, check-in/out, current and stale open-shift states, history, facility label, retry/double-submit behavior, own-row isolation, and authorized recovery.
- Phase Workflow: legacy and normalized display, valid transition plus one audit row, stale/dependency/cross-project/contributor/cancelled denials, and browser-execute denial.
- Comments/activity: bounded reads, authorized project/task comment, immutable history, server-derived actor, and cross-project/browser-write denial.
- Project/task atomic create: exactly-once all-or-nothing persistence, duplicate/invalid/cross-project/inactive-member denial, no partial rows, and service-role-only RPC execution.
- Account/workspace: employee/Auth linkage, known/unknown permission codes, authorized grant/revoke, and fail-closed fixtures.
- Legacy ledger/dashboard: empty and populated reads, create/edit retry and duplicate-submit protection, paid-ledger dashboard data, denied/error states, and sanitized errors. Do not activate the new reimbursement/storage workflow.
- Payroll: run the registered pre/forward/post package, configure the first month explicitly, then verify own-row isolation, denied cross-employee access, unauthorized settlement denial, duplicate rejection, immutable original, adjustment/audit provenance, and unchanged legacy rows before enabling the runtime gate.

## Safe merge and rollout order

1. Review this branch and its PR for secrets, unexpected migrations, unresolved review findings, and target-branch conflicts.
2. Require repository checks and protected-branch approval; do not merge from this handoff process.
3. When approved, merge through protected `main`. Let the Supabase GitHub Integration apply only tracked forward migrations; never replay a migration already present in production history.
4. Keep all nine runtime flags false/unset after merge.
5. Execute the operator gates in the order above, retaining pre/post, authorization, RLS, smoke, and monitoring evidence at every gate.
6. Enable only the single gate whose evidence is complete. Stop and disable it on any matrix/runbook rollback trigger.
7. Keep Ledger/Reimbursement disabled until its reviewed package, private Storage/RLS boundary, authorization fixtures, and smoke tests pass. Keep Payroll disabled until its reviewed package, explicit first-month configuration, authorization fixtures, and smoke tests pass.

## Ledger/Reimbursement package — 2026-07-28

The former business-decision blocker is resolved. Repository delivery is complete and `LIVE_APPROVAL_REQUIRED`: pre-run `supabase/drafts/20260728153000_ledger_reimbursement_pre_run.sql`, forward migration `supabase/migrations/20260728153000_ledger_reimbursement_workflow.sql`, post-run validation, rollback, storage policy, and smoke checklist share the `20260728153000` identifier. Deliver the forward file only through protected main/Supabase GitHub Integration after review. Do not execute SQL directly, rewrite legacy rows, create a public bucket, or enable `FINANCE_REIMBURSEMENT_ENABLED` in this handoff.

Remaining operator work: retain pre-run legacy salary counts, approve/deliver the migration and private Storage/RLS boundary, retain post-run/RLS/authorization/smoke PASS evidence, then separately approve the runtime flag. Existing salary rows with null beneficiary must remain null and render **Chưa xác định**. Payroll snapshots remain immutable; a ledger relationship uses only `source_type` and `source_reference`.

## Functional stabilization handoff — 2026-07-28

Item 15 safe application work is complete. The final pass prevents stale Payroll month responses from replacing current state, exposes Vietnamese pending states for settlement/adjustment, preserves the synchronous duplicate-submit lock, and disables Retry during an active replacement request. The runtime-disabled response remains **Tính năng quyết toán lương chưa được kích hoạt.** No legacy settlement or reimbursement persistence is simulated.

The exact next roadmap item is **Item 16 — Runtime gate readiness/operator evidence**, beginning with Facility verification in the registered order. Scoped SaaS UI work is `PARTIALLY_SAFE` for later planning on functional-only journeys; broad re-skin remains blocked. No SQL was executed, no runtime flag was enabled, and no deployment or merge occurred.
