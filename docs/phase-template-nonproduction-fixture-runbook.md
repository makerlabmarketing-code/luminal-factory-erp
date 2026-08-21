# Phase Template Non-Production Fixture Runbook

**Status:** `PACKAGE_READY / NOT_EXECUTED`

## Boundary

This runbook owns the remaining Phase Template authorization and atomicity
matrix. The executable fixture is
`supabase/validation/20260821_phase_template_nonproduction_fixture.sql`.

It is for an existing, explicitly confirmed non-production database only. Do
not create a paid Supabase branch for this check. Do not substitute production,
even though the script ends with `rollback`: PostgreSQL identity sequences can
advance despite transaction rollback.

This package has not been executed. It does not authorize migration promotion,
production SQL, runtime activation, deployment, or merge.

## Prerequisites

1. PR #177 protected review has no unresolved actionable finding.
2. A no-cost existing `LOCAL`, `STAGING`, or `EPHEMERAL_TEST` Supabase database
   is explicitly identified as non-production.
3. The review-only forward, project-create replacement, and management RPC have
   been applied to that non-production database in the reviewed order.
4. `supabase/validation/20260821_phase_template_validation.sql` passes.
5. Three non-production fixture values are available:
   - an active mapped Auth UUID with `ADMIN_WORKSPACE`,
     `PHASE_TEMPLATE_MANAGE`, and `PROJECT_MANAGE`;
   - an active mapped Auth UUID without either manage permission;
   - an active manager Employee ID.
6. No real Auth UUID or Employee ID is committed or retained in screenshots,
   logs, PR comments, or evidence.

Stop if any prerequisite is false. Do not provision a new paid environment to
satisfy this runbook.

## Execution

In the non-production SQL runner only:

1. Copy the fixture SQL into the runner.
2. Replace the four placeholders in-memory:
   - `<CONFIRMED_NON_PRODUCTION_ENVIRONMENT>` with `LOCAL`, `STAGING`, or
     `EPHEMERAL_TEST`;
   - `<AUTHORIZED_AUTH_UUID>`;
   - `<DENIED_AUTH_UUID>`;
   - `<MANAGER_EMPLOYEE_ID>`.
3. Confirm the runner target again before execution.
4. Execute the whole file once. Do not remove its outer `begin`/`rollback`.
5. Retain only the redacted terminal result and PASS/FAIL matrix.

Expected terminal row: `PHASE_TEMPLATE_NONPRODUCTION_FIXTURE_PASS`.

Any exception, timeout, missing object, unexpected result code, or absent final
PASS is a failed run. Do not retry unchanged SQL more than once; inspect the
first failing assertion and return the package to review.

## Matrix covered

| Case | Expected evidence |
|---|---|
| SQL `NULL` payload | Both privileged RPCs return controlled `payload_validation_failed`. |
| Denied template actor | `permission_forbidden`; no template or audit row. |
| Authorized lifecycle | Create, update, publish, clone, archive, restore, and eligible draft delete succeed with audit. |
| Invalid stage order | Update fails and the prior complete draft remains unchanged. |
| Duplicate normalized names | Update fails and the prior complete draft remains unchanged. |
| Stale/archived version | Project creation returns `template_version_not_current`; no project row. |
| Custom/cross-project input | Template plus client workflow input is rejected; no project row. |
| Client actor field | Rejected before persistence. |
| Denied project actor | `permission_forbidden`; no project row. |
| Deadline overflow | `template_deadline_overflow`; no project row. |
| Successful clone | Two zero-based phases, three tasks, flags, schedule, provenance, audit, and activity match the template. |
| Role resolution | Project Manager resolves only through active membership; missing Creative Lead remains unassigned. |
| Forced late failure | A rollback-only trigger fails provenance insertion after earlier writes; the RPC returns failure and leaves zero partial project/workflow rows. |
| Final deltas | Exactly one successful project, two phases, three tasks, and one application exist inside the transaction before final rollback. |

## Stop conditions

Stop immediately on a production or unconfirmed target, a real identifier in a
repository diff, browser table writes, `anon` RPC execution, authorization
bypass, invalid input persistence, unrelated Employee assignment,
non-contiguous order, missing provenance/audit/activity, any partial forced
failure, or removal/non-execution of the final `rollback`.

## Evidence and next gate

Retain a redacted matrix with environment class, reviewed commit SHA, schema
validation PASS, fixture terminal PASS, and confirmation that the transaction
rolled back. Do not retain fixture identities.

After PASS, the package may return to protected review for migration-promotion
approval. Production delivery and `PHASE_TEMPLATES_ENABLED=true` remain two
separate approvals. A fixture PASS never activates production.

## Rollback

The fixture's required rollback is its final transaction `rollback`; it leaves
no fixture business rows or trigger. If execution aborts before that statement,
issue `rollback` in the same session before investigation. Sequence gaps in
non-production are acceptable and must not be repaired.

The production safety rollback remains
`supabase/rollbacks/20260821_phase_template_rollback.sql` and is not authorized
by this runbook.
