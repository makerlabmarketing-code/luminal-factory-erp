# Phase members — reviewed draft, LIVE_APPROVAL_REQUIRED

Goal: allow multiple project members to work in a phase, selected by checkboxes.
This is separate from project membership and individual task assignment.

## Proposed database delta

- New `project_phase_members`: phase/employee composite primary key; both are FK
  references; actor FK and assignment timestamp. No cross-project free text key.
- New `project_phase_member_audit`: immutable before/after employee ID arrays,
  project/phase/actor FK and timestamp. Triggers reject UPDATE/DELETE.
- New invoker RPC `set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint)`.
  Only service_role can execute. It locks project then phase, repeats actor and
  candidate checks, rejects stale sets, replaces membership and writes audit in
  one transaction. A retry of a completed set does not duplicate history.
- RLS on both tables; no anon/authenticated policies or grants. Access is via
  existing authenticated ERP server phase authorization. Browser never supplies actor.
- New indexes for employee lookup and phase history. No old row or grant is changed.
- No old data conversion; no employee names guessed from legacy stage_owner.
- No permission, phase status, task-assignment, payroll or email flag is opened.

## App scope and compatibility

New phase-specific GET/PUT endpoint and `Người thực hiện` section with `Phân người`
checkbox dialog. Only eligible existing project members can be selected. Revoked
assignments remain identifiable and can be removed. Routine saves need no extra
note; audit is automatic. Assignment does not alter work item assignees.

`PHASE_MEMBERS_ENABLED` defaults false. Disabled reads authorize first but never
query absent tables; writes return a controlled 409. The older application works
with the additive schema. Current Production schema inspection confirms both new
tables and RPC are absent. Existing phase and project-member data stays intact.

## Validation completed

- 982 Vitest tests / 138 files pass, including 8 new tests for payload validation,
  server-only actor, authorization, flag gate, reads, stale/revoked errors and
  database-failure presentation.
- SQL exercised on an isolated PGlite PostgreSQL engine using disposable fixtures:
  multi-person sets, de-duplication, retries/no duplicate audit, stale overwrite,
  outsider/revoked/inactive rejection, denied roles, project mismatch, closed
  project/phase rejection, LOCKED phase planning, admin/global manager access,
  clearing, atomic audit-failure rollback, immutable history, RLS and grants,
  guarded rollback and unused-schema cleanup. Engine test: `test.mjs`.
- Lint, production build, TypeScript and diff checks pass.
- Not run: Production SQL execution, real PostgREST schema refresh/grant smoke,
  browser successful save, real concurrent-session race test. These are rollout
  gates after approval; PGlite validates statements but not network concurrency.

## Concrete approval requested

Approve the exact forward.sql SHA-256 recorded in forward.sha256, then:

1. Stage the approved forward SQL via the configured migration naming/delivery
   workflow under supabase/migrations (draft is deliberately outside that folder).
2. Merge the protected PR and deliver the approved migration. Inspect catalog,
   FK, RLS, grants, RPC invoker/search_path and empty row counts with validation.sql.
3. Set only server `PHASE_MEMBERS_ENABLED=true`, redeploy and verify authorized and
   denied GET/form paths. Confirm a real valid save with owner-provided people and
   phase; do not invent employees/assignments for a Production smoke test.
4. Update the shared roadmap with migration version, deployment commit and checks.

Current standing approval for application auto-merge/deploy does not approve new
live SQL. AGENTS.md requires explicit LIVE_APPROVAL_REQUIRED for SQL/RPC delivery.
Do not merge this draft or activate its flag before that approval.

## Rollback

Disable PHASE_MEMBERS_ENABLED first; redeploy/revert application. Keep assignment
and audit tables to preserve history. rollback.sql removes the unused schema only
when both new tables are empty; it deliberately refuses to discard live history.
No change to existing stages/members/tasks must be rolled back.
