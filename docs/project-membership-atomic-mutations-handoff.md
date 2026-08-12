# Project Membership Slice 2 — Atomic Mutation Handoff

Status: **READY_FOR_OPERATOR — runtime flag remains false/unset**  
Date: 2026-08-12

## Delivered boundary

The application authorizes the authenticated ACTIVE Employee first, requires a
reason, creates the correlation ID on the server, and calls one service-role-only
RPC. The RPC repeats the actor/project authorization checks inside the same
transaction that changes membership and writes audit history.

The approved rules are preserved:

- one ACTIVE role per Employee/project;
- more than one Project Owner is allowed;
- the final active Project Owner cannot be changed or revoked;
- a member with a task outside `COMPLETED` or `CANCELLED` cannot be revoked;
- role change revokes the old historical row and creates the new active row in one
  transaction;
- cancelled projects are read-only;
- every successful add/change/revoke has immutable actor, reason, correlation,
  before state, and after state.

## Operator order

1. Keep `PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED=false` or unset.
2. Retain results from
   `supabase/validation/20260805_project_membership_baseline_readonly.sql`.
3. Confirm duplicate ACTIVE Employee/project groups are zero and normalized task
   assignment fields are available.
4. Let protected-main merge and the Supabase GitHub Integration deliver
   `supabase/migrations/20260812090000_project_membership_atomic_mutations.sql`.
5. Retain results from
   `supabase/validation/20260812090000_project_membership_atomic_mutations_validation.sql`.
6. Verify authenticated browser roles cannot write `project_members`, cannot read
   or mutate `project_membership_audit`, and cannot execute the RPC.
7. Exercise authorized/denied Owner, Manager, Contributor, Admin, inactive
   Employee, cancelled project, last-owner, duplicate-role, cross-project, and
   active-task fixtures in a non-production verification set.
8. Enable the runtime flag only after every check passes.

## Rollback

Disable the runtime flag first. Export and retain `project_membership_audit` before
using the rollback because dropping that table is permanent data loss. Apply
`supabase/rollbacks/20260812090000_project_membership_atomic_mutations_rollback.sql`
only through an approved operator process, then roll back the matching application
commit. Verify member reads still work and the previous compatibility write policy
is restored.

## Not performed

- no production SQL, migration, backfill, RLS mutation, or live data mutation;
- no runtime flag activation;
- no deployment or protected-main merge.
