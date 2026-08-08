# Finance linked-ledger atomic edit PR handoff

This slice replaces the old compensation/503 boundary for linked ledger edits with a server-authorized PostgreSQL transaction.

The production RPC has already been delivered in dormant server-only form and transaction-smoke validated with zero retained test rows. The owning PR must still pass final Vercel build and review before the application route starts using it in production.

The legacy authenticated-execute draft is explicitly superseded. The known ambiguous legacy counter group is not mutated by this slice and remains fail-closed.
