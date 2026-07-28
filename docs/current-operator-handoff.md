# Current Operator Handoff

**Prepared:** 2026-07-28

**Branch:** `work`

**Boundary:** repository delivery only. This handoff did not execute SQL/RPC, enable a runtime flag, deploy, or merge.

## Repository package verification

The branch contains the completed application slices and focused tests recorded in the [implementation roadmap](ERP_IMPLEMENTATION_ROADMAP.md). The seven production runtime gates have complete pre-run, forward, post-run/validation, rollback, authorization/RLS, regression, disabled-state, and smoke-test coverage according to the [activation matrix](runtime-gate-activation-matrix.md). The exact operator commands and stop conditions remain owned by the [production runbook](production-runtime-gate-operator-runbook.md); the ordered SQL/RPC register remains owned by the [SQL handoff](production-operator-sql-handoff.md).

Repository validation completed for this handoff:

- `npm test`: PASS — 52 files and 411 tests.
- `npm run lint`: PASS with three pre-existing warnings (`next/image` and two hook-dependency warnings).
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS with the recorded lint, Edge Runtime, webpack cache, and Node 20 deprecation warnings.
- `git diff --check`: run after this document update and before commit.

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

- `FACILITY_ACTIVE_STATE_ENABLED`
- `ATTENDANCE_RECOVERY_ENABLED`
- `PHASE_WORKFLOW_FOUNDATION_ENABLED`
- `PHASE_STATUS_MUTATION_ENABLED`
- `TASK_COMMENTS_ACTIVITY_ENABLED`
- `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`
- `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`

## Business decisions required

### Ledger and reimbursement

Approval is still required for the finance category model, executor/beneficiary/payer ownership, legacy-ledger mapping, reimbursement requester/recipient and self-approval rules, and private receipt/storage access and retention policy. Re-review and promote the prepared finance package only after those decisions are recorded.

### Payroll

Approval is still required for official shift boundaries, settlement revision versus immutability, the first settlement month, and employee own-salary access. Payroll has no approved runnable settlement package; design the forward, rollback, validation, RLS, compatibility, and smoke artifacts only after the business contract is approved.

## Production smoke-test checklist

For each approved gate, retain the pre-run output, confirm migration history before applying any tracked migration, apply through exactly one approved workflow, require post-run PASS, exercise both authorized and denied fixtures, monitor the affected routes/RPCs, and disable the flag before rollback. The minimum journey checks are:

- Facility: directory read, legacy code/name resolution, active/inactive behavior, and browser-write denial.
- Attendance: normal Staff access, check-in/out, current and stale open-shift states, history, facility label, retry/double-submit behavior, own-row isolation, and authorized recovery.
- Phase Workflow: legacy and normalized display, valid transition plus one audit row, stale/dependency/cross-project/contributor/cancelled denials, and browser-execute denial.
- Comments/activity: bounded reads, authorized project/task comment, immutable history, server-derived actor, and cross-project/browser-write denial.
- Project/task atomic create: exactly-once all-or-nothing persistence, duplicate/invalid/cross-project/inactive-member denial, no partial rows, and service-role-only RPC execution.
- Account/workspace: employee/Auth linkage, known/unknown permission codes, authorized grant/revoke, and fail-closed fixtures.
- Legacy ledger/dashboard: empty and populated reads, create/edit retry and duplicate-submit protection, paid-ledger dashboard data, denied/error states, and sanitized errors. Do not activate the new reimbursement/storage workflow.
- Payroll: retain current calculation regression only; do not attempt settlement rollout before the business decisions and package exist.

## Safe merge and rollout order

1. Review this branch and its PR for secrets, unexpected migrations, unresolved review findings, and target-branch conflicts.
2. Require repository checks and protected-branch approval; do not merge from this handoff process.
3. When approved, merge through protected `main`. Let the Supabase GitHub Integration apply only tracked forward migrations; never replay a migration already present in production history.
4. Keep all seven runtime flags false/unset after merge.
5. Execute the operator gates in the order above, retaining pre/post, authorization, RLS, smoke, and monitoring evidence at every gate.
6. Enable only the single gate whose evidence is complete. Stop and disable it on any matrix/runbook rollback trigger.
7. Leave Ledger/Reimbursement and Payroll disabled until their business decisions and reviewed delivery packages are approved.
