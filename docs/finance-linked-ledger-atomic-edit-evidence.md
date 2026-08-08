# Finance linked-ledger atomic edit evidence

Date: 2026-08-09 ICT

## Production preflight

- `financial_ledger` RLS enabled.
- authenticated mutation RLS policy absent; existing authenticated policy is Admin SELECT only.
- `service_role` bypasses RLS and is used only by server-side Supabase Admin client.
- preflight row counts: 64 ledger rows, 21 active managed counter rows.
- one legacy active counter identity is ambiguous; application/RPC fail closed for that identity.

## Delivered database boundary

Live Supabase migration history: `20260808175603 finance_linked_ledger_atomic_edit`.

Source-controlled forward: `supabase/migrations/20260809004500_finance_linked_ledger_atomic_edit.sql`.

Validated RPC contract:

- `SECURITY INVOKER` (`security_definer=false`)
- `anon`: no EXECUTE
- `authenticated`: no EXECUTE
- `service_role`: EXECUTE
- browser callers cannot invoke the mutation RPC
- application API retains `ADMIN_WORKSPACE + FINANCE_UPDATE` authorization before the service-role call

## Transaction smoke

A disposable transaction created one temporary primary ledger row and exercised the RPC through:

1. CREATE linked counter;
2. UPDATE linked counter identity and amount;
3. CANCEL linked counter.

Every expected action and row count passed. The transaction was explicitly rolled back. Final retained query result:

- `atomic_smoke = PASS`
- `persisted_smoke_rows = 0`

No business row from the smoke test remains in production.

## Advisor review

Security and performance advisors were checked after DDL delivery. The returned findings were pre-existing project/database advisories; no new finding named the delivered atomic ledger RPC.

## Remaining verification

After the owning application PR is merged and production Vercel deployment is READY, perform an authenticated Admin end-to-end edit against a disposable/non-ambiguous linked ledger record when such a record is available, then revert it through the same UI/API flow. Do not use the known ambiguous legacy counter identity as a smoke target.
