# Linked finance ledger edit atomicity package

Status: **DATABASE_DELIVERED — APPLICATION_DEPLOYMENT_PENDING**.

## Production evidence (2026-08-09 ICT)

The previous operator draft was reconciled against the live Supabase project before delivery. Production evidence showed:

- `financial_ledger` RLS is enabled.
- `authenticated` has only an Admin SELECT RLS policy; it does not have a mutation policy that could safely support the old authenticated `SECURITY INVOKER` plan.
- `service_role` bypasses RLS and remains server-only in the application architecture.
- 64 ledger rows and 21 active managed counter rows existed at preflight time.
- one legacy counter identity is ambiguous. The new RPC therefore fails closed on ambiguous existing links instead of choosing an arbitrary row.

The delivered migration is `finance_linked_ledger_atomic_edit` (live Supabase migration history version `20260808175603`; source-controlled migration `supabase/migrations/20260809004500_finance_linked_ledger_atomic_edit.sql`). It installs `public.update_linked_financial_ledger_entry(...)` as `SECURITY INVOKER`, revokes EXECUTE from `public`, `anon`, and `authenticated`, and grants EXECUTE only to `service_role`.

Authorization remains in the server API: the application requires `ADMIN_WORKSPACE` plus `FINANCE_UPDATE` before the service-role client invokes the RPC. No service-role credential is exposed to the browser.

## Atomic behavior

The RPC:

1. locks the primary ledger row;
2. serializes the old and target counter identities with deterministic advisory-lock ordering;
3. rejects more than one active counter for the original identity (`21000`);
4. rejects a conflicting active counter at the target identity (`23505`);
5. updates the primary row and performs `CREATE`, `UPDATE`, `CANCEL`, or `NONE` for the managed counter inside the same PostgreSQL transaction;
6. rejects direct edits of managed counter rows;
7. returns the counter action to the caller.

The application wrapper falls back to the existing update path when no linked-counter mutation is required. Linked edits use only the atomic RPC.

## Validation retained

After migration delivery:

- `security_definer = false`;
- `anon_execute = false`;
- `authenticated_execute = false`;
- `service_role_execute = true`;
- ledger RLS remains enabled;
- a disposable transaction exercised CREATE → UPDATE → CANCEL and then `ROLLBACK`;
- the smoke result was `PASS` and `persisted_smoke_rows = 0`.

Supabase security/performance advisor results after delivery contained pre-existing repository/database advisories but no new advisory specific to this RPC.

## Remaining gate

The database boundary is delivered and dormant to browser callers. Merge the owning application PR only after the final Vercel preview is READY and PR review is clean. After production deployment, retain one authenticated Admin end-to-end linked-ledger edit/revert smoke if a suitable disposable business record is available. Do not use the known ambiguous legacy counter group for smoke testing.

The old `supabase/drafts/20260731_finance_linked_ledger_edit_forward.sql` plan is superseded and must not be executed.
