# E-012 — Payroll/ledger linked obligations

Status 2026-11-05: **IMPLEMENTED_DRAFT / NOT_APPLIED / TESTENV_QA_PENDING**.

## Owner-confirmed lifecycle extension · 05/11

Before payment, reopen supersedes the old snapshot/link and soft-cancels its source
obligation atomically; the existing normal finance list hides cancelled rows.
Reclose creates a new snapshot/obligation while retaining prior adjustment history.
Before payment, ordinary adjustments update the pending obligation in place.

After payment, the base snapshot/obligation/email stays immutable. A separate
`create_payroll_supplement` RPC requires PAYROLL_ADJUST and an already-paid active
linked base, accepts only a positive whole delta with reason/request UUID, and
creates an unpaid `PAYROLL_SUPPLEMENT` obligation. Request reuse with changed intent
fails; identical retries return the same obligation. Its immutable source table has
RLS, no browser access, service-role SELECT only and no client mutation privilege.
The private permit guard covers supplementary ledger rows as well as base rows.
Payment validates the source delta/parent/month, uses the existing service-only
payment API, and queues only the delta once when explicitly confirmed. Creation
does not pay or send email. Supplement values never change the original payable.

The manager UI hides reopen/base-adjustment controls for a paid linked base,
shows a separate positive-addition dialog and lists supplemental obligations.
The finance editor/payment boundary recognizes the reserved supplemental marker.
No automatic salary deduction, refund or supplementary cancellation policy is added.
SQL stays a draft until this revised package is approved for live delivery.

## Missing-ledger repair continuation · 05/11

The owner reported an existing settled payroll missing from finance. Prepared an
operator-only `reconcile_unlinked` helper: verify exact snapshot, employee, month,
payable and actor; refuse ambiguous legacy rows/email; create one unpaid source
obligation and audit atomically without re-settling. A retry validates and returns
the same link. The helper has no application/service-role execute privilege.
`activate-reviewed.sql` is an unbound, fail-closed operator template: fill the
reviewed identity privately, refuse other unreviewed active snapshots, reconcile
and switch ON in the same transaction. It is not an automatic backfill. Real
employee financial details are deliberately excluded from this public repository.

The payroll screen now reads source-linked status only for FINANCE_VIEW users,
shows a missing obligation explicitly, and links to the correct finance month.
After settling it reloads the server result instead of inventing settled time or
actor locally. Neither this UI nor the repair confirms payment or sends email.

Added reconciliation mismatch/ambiguity/rollback/idempotency/stale/ACL checks and
the deployed activity, immutable-history and no-delete triggers to the disposable
runner. New native race evidence must be recorded on the delivery PR. Existing
Production trigger/catalog checks are read-only; SQL and activation still require
review of this concrete package. Application shipping is not SQL activation.

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
application dependency. These cases could not run in this cloud executor; they
subsequently passed on the GitHub-hosted runner described below.

Before live readiness: run those races, then inspect this exact package on a
matching Supabase test environment with real RLS/grants/metadata/history triggers,
two browser sessions and actual rendered zero/positive/reopened rows. Check denied
staff/finance/anonymous access, explicit payment confirmation, QR contents and no
mail on zero/settlement/reopen. Do not use real staff payroll or send real mail just
to produce PASS evidence. SQL approval and separately controlled activation follow
passing evidence; the current package remains NOT_APPLIED.

## CI concurrency acceptance

The [PostgreSQL race workflow](../../../.github/workflows/payroll-ledger-concurrency.yml)
runs this same runner on an ordinary GitHub-hosted Ubuntu user. It starts a fresh
loopback-only cluster using the pinned external test package, not a Supabase URL.
No Production credentials, environment secrets, SMTP, deployment or live migration
are used. The job has read-only repository permissions and does not persist checkout
credentials. `E012_REQUIRE_CONCURRENCY=1` makes the job fail if real clients are
missing, so a successful sequential PGlite run cannot masquerade as race acceptance.
CI success must show all five lock-overlap cases; workflow creation alone is not PASS.

[Run 41957492424](https://github.com/makerlabmarketing-code/luminal-factory-erp/actions/runs/41957492424/job/127015786890)
passed on PostgreSQL 17.11 for head `bc271e8`: all 21 lifecycle cases and all five
real overlapping two-connection cases, 26 total. The runner observes the second
backend waiting on a PostgreSQL lock before committing the first transaction.
This proves the tested fixture races, not freedom from every possible deadlock or
compatibility with all deployed Supabase triggers and authorization metadata.

On 05/11 the owner separately authorized a browser test on tungduy. On the current
Production application, Đào Tùng Duy's November 2026 zero payroll was settled,
reloaded successfully, reopened with an explicit test reason and reloaded again.
The preserved reopening history displayed the correct actor. The final period is
open. This is baseline UI acceptance only: linked SQL remains NOT_APPLIED, and no
payment was confirmed. It does not replace integrated-row browser or race acceptance.
