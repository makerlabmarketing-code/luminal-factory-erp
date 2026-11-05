# E-012 — Payroll/ledger linked obligations

Status 2026-11-05: **IMPLEMENTED_DRAFT / NOT_APPLIED / CONCURRENCY_QA_PENDING**.

The owner approved continuing from [the design](../../../specs/payroll-ledger-link.md).
This is a reviewable draft package, not authorization to apply SQL, enable the
integration, backfill old payroll, send email, or create real salary transactions.
No file from this directory belongs in `supabase/migrations/` yet.

## Included behavior

- `forward.sql` preserves the four existing deployed RPC implementations in an
  unexposed private schema, replaces their public entrypoints with guarded wrappers,
  and creates the link table, private configuration and transaction write permits.
  The exact original implementations are retained rather than copied from a stale
  migration. Search paths are fixed, private schema/function/table privileges are
  revoked, and the existing authenticated versus service-only API split is kept.
- Mode defaults to `OFF`. With no links, payroll follows its original behavior.
  `ON` atomically creates one unpaid ledger obligation, including 0-value rows;
  updates its amount with adjustments; supersedes/soft-cancels it on reopening;
  and validates active snapshot, employee, amount and month before payment.
- Negative totals fail the whole transaction. Reclose carries adjustments from
  all snapshots in the employee/month once. Legacy salary ambiguity stops the
  operation instead of choosing a record by name/month or making another debt.
- Direct edits, unpay, soft-cancel, restore and delete of linked ledger rows are
  rejected at the database boundary. An operation-specific private transaction
  permit is not a spoofable session setting. Linked source rows use the reserved
  `payroll-ledger:<snapshot UUID>` idempotency identity.
- All four wrappers and manual salary writes share the existing global advisory
  lock. Existing row-first write paths may deadlock; PostgreSQL must abort one
  transaction, never commit a partial operation. Real overlapping tests remain a
  release requirement below. This is not a claim of proven deadlock-free behavior.
- Application preparation reads the source marker, shows **Không phát sinh thanh
  toán** for 0-value obligations, removes QR/payment/manual edit there, and shows
  replaced rows as history. Positive rows keep explicit paid confirmation; their
  month comes from the source instead of another input prompt. Legacy rows retain
  their explicit salary-month confirmation and existing actions.
- Server-side edit boundaries reject linked-row edits, payment refuses zero/unpay
  or disabled salary email, and database checks repeat the authoritative validation.
  Settlement and adjustment never dispatch SMTP. Payment retains the existing
  immutable email snapshot/retry boundary.

## Files and rollout boundaries

| Artifact | Purpose |
| --- | --- |
| `preflight.sql` | Read-only catalog/function hashes/grants/triggers/constraints and reserved-marker collisions. Lists active snapshot IDs for reconciliation, not mutation. |
| `forward.sql` | Reviewed draft DDL, mode OFF, 0 salary/ledger/email rows. Creates one private OFF configuration row only. |
| `validation.sql` | Read-only RLS/grants/function inspection and link/zero-payment/permit invariants. |
| `rollback.sql` | Restores the retained original RPCs and intended API grants only while there are no links/permits. Refuses populated rollback. |
| `test.mjs` | Genuine existing payroll functions plus draft SQL on disposable PostgreSQL, transaction failure, permissions and lifecycle cases. |
| `local-postgres.mjs` | Optional loopback-only fresh PostgreSQL cluster for five genuine two-connection races; accepts no Production URL or credentials. |
| `tests/payroll-ledger-*.test.ts` | CI fixture runner, source identity, server month/zero guards and rendered row actions. |

Before a migration is proposed, retain exact `pg_get_functiondef`, ACL, owner and
dependency evidence from preflight. Stop on an unexpected overload, public/private
schema collision, marker collision, missing required columns/constraints/history
guards or unexpected function consumers. In particular preserve
`salary_payroll_reopen_guard`, `salary_email_payroll_reopen_guard`, immutable salary
snapshots, immutable history and financial no-delete triggers. Verify the private
schema is not in the Data API exposed-schema list. A DB role grant does not make
that schema a public API.

Source metadata read on 05/11 confirmed the required ledger columns, source unique
constraint and four RPC signatures/definitions; a separate read-only marker count
was **0**. This is not complete migration preflight or business acceptance.

Application code can ship before this SQL: no existing row has the reserved marker
and no new table query is added to ordinary reads. Activation additionally requires
the extended finance schema/reader and salary-payment server boundary to be enabled
and verified; changing flags is not included in this package. Never activate SQL
mode ON with an older application or disabled extended reader/email boundary.

## Legacy/backfill and compatibility

There is deliberately no backfill. Existing active snapshots have no link and
therefore require explicit reconciliation before integrated adjustment/reopen;
the package must not invent a second payable. Do not enable ON while an official
payroll window still relies on unreviewed legacy snapshots. Review exact snapshot,
employee, month, ledger and email IDs, then prepare any compatibility operation as
a separate exact-ID reviewed transaction. Names, amount=0, age and descriptions
do not identify disposable test data. No existing test entry is deleted here.

Configuration controls are operator-only and share no new public endpoint. OFF is
not an emergency fallback after use: wrappers reject writes if OFF and links exist.
PAUSED intentionally stops integration payroll operations. Linked payment is also
blocked while paused; ordinary unrelated ledger records retain the old boundary.
After linked rows exist, rollback is a forward fix or reviewed data-preserving
reconciliation. Never drop the links, remove guards, reactivate old debts, undo a
paid confirmation, or resend notifications to make rollback appear successful.

## Validation and remaining acceptance

The disposable runner has **21 sequential PostgreSQL cases**, including real
transaction rollback, prepared RPC plans from before rollout, preserved original APIs, generated zero/different totals,
carried adjustments, protected writes, fake GUC bypass, legacy duplicates, actual
authenticated-role entrypoint and denied private table/schema access. These are
executed in CI via PGlite. They are not two concurrent PostgreSQL sessions.
Application tests exercise server payment routing/month derivation and rendered
zero/positive/superseded row actions. Full gate results are retained in the delivery
record: 1,041 Vitest tests / 150 files, lint and TypeScript passed; the production
webpack build passed. These counts include 21 PostgreSQL cases inside one runner
test; they are not 21 separate Vitest tests.

Five additional overlapping races are implemented in `test.mjs`: duplicate settle,
reopen before payment, payment before reopen, adjustment before payment and payment
before adjustment. The second connection must visibly wait on a PostgreSQL lock
before the first transaction commits. Run them on a disposable local cluster:

```sh
npm install --prefix /tmp/e012-postgres --no-audit --no-fund embedded-postgres@17.11.0-beta.19
E012_LOCAL_PG_FACTORY="$PWD/supabase/drafts/payroll-ledger-link/local-postgres.mjs" \
EMBEDDED_POSTGRES_MODULE=/tmp/e012-postgres/node_modules/embedded-postgres/dist/index.js \
node supabase/drafts/payroll-ledger-link/test.mjs
```

Use an ordinary unprivileged local user; do not create users or weaken environment
permissions for the test. The current cloud executor is root in a user namespace
that cannot switch to an unprivileged UID (`runuser` group setup is unavailable;
dropping only the child process UID also fails). PostgreSQL therefore could not be
started here. The installed test binary is outside the repository; it is not a new
application dependency. **The five two-connection cases have not passed here.**

Before live readiness: run those races, then inspect this exact package on a
matching Supabase test environment with real RLS/grants/metadata/history triggers,
two browser sessions and actual rendered zero/positive/reopened rows. Check denied
staff/finance/anonymous access, explicit payment confirmation, QR contents and no
mail on zero/settlement/reopen. Do not use real staff payroll or send real mail just
to produce PASS evidence. SQL approval and separately controlled activation follow
passing evidence; the current package remains NOT_APPLIED.
