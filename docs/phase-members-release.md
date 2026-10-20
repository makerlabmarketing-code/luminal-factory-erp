# Phase members approved delivery — 2026-10-20

The user explicitly approved PR #238's exact SQL and feature activation with
“ok lam đi” on 2026-10-20 after reviewing the two-table/RPC package.

Approved forward SHA-256:
7fc69904f01d8d11d1b7ae84f7f16049bea191c581bd81c040b11e7a5ce61431

The CLI created migration 20261020021856_phase_members_atomic.sql; its bytes match
the reviewed forward SQL. CLI creation succeeded, then telemetry shutdown timed
out; the migration was inspected instead of creating a second filename.

Existing tests: 982/138 files; SQL PGlite fixtures, lint/build/TypeScript passed
on PR head 99d0945. This delivery commit stages the unchanged reviewed SQL and
records approval only. Postflight, runtime activation and browser results are
tracked in the shared coordination sheet after protected merge.

Do not create or infer real project assignments for smoke testing. Verify the
checkbox form and read path; valid-save testing requires a specified assignment.
Rollback: disable PHASE_MEMBERS_ENABLED and retain populated audit tables. See
supabase/drafts/phase-members/rollback.sql for guarded unused-schema removal.
