# Raffle participants

9 October 2026: Owner requested a Comeback raffle and ERP participant management.
`/admin/commerce/raffles` lists raffles, opening/closing times in Vietnam time,
and participants by selected raffle. Customer names/emails are searchable;
shipping addresses are collapsed by default. Shared CommonTable, row action
rendering and Luminal loading are used. Superseded requests are aborted and
old participant data is cleared when changing raffle.

Data stays in Commerce Supabase. ERP server signs read-only HMAC requests to
`/api/admin/v1/raffles` and `/api/admin/v1/raffles/:id/entries`; browser requests
never hold Commerce credentials. UUIDs, response shapes and each entry's
raffle association are checked before returning customer data. Responses use
private no-store headers. Response caps fail closed rather than truncate.

`COMMERCE_RAFFLE_VIEW` and `COMMERCE_RAFFLE_ENTRY_VIEW` are independent from
Product/Hero permissions. Owner's existing permission override permits these
operations. Other staff must be explicitly provisioned with the dedicated
permissions; this delivery does not grant access or copy PII into the ERP DB.

Comeback draft: `d6c1e22d-bca6-4570-a678-f944e56af855`, unpublished, 10 October
2026 12:00 to 12 October 2026 12:00 Asia/Ho_Chi_Minh. Requested price 80 USD is
in draft copy; authoritative price needs the new colorway association before
publishing. New email queue, cron SQL, sender setup and live mail verification
are governed by Commerce's `supabase/drafts/comeback-entry-email/README.md`.
This participant screen does not select winners, collect payment or alter
entries.

10 October 2026: `/admin/commerce/raffles/:id` separates information editing
from the participant list. The dedicated `COMMERCE_RAFFLE_MANAGE` permission
allows title, summary, participation rules and the opening/closing window to
be saved through the existing signed `commerce.raffle.write` PATCH contract.
ERP rechecks the record before sending a write and offers editing only for
unpublished, non-test DRAFT records. Commerce's existing `manage_raffle` RPC
remains authoritative, including its entrant conflict rules. There is no new
SQL, permission grant, publication action, price edit or email activation.

The API rejects cross-origin requests, malformed JSON, extra mutation fields,
invalid dates and bodies over 64 KB. Dates display and convert explicitly in
UTC+7. Network retries of unchanged information reuse their operation ID;
unsaved changes warn on reload and internal link navigation. History/back
navigation and concurrent edits by another operator are not locked. The
existing Commerce RPC has no revision/CAS guard, so avoid simultaneous edits
or publication by multiple operators; ERP preflight is not an atomic lock.

Validation: focused parser/service tests cover date boundaries, write scope,
metadata preservation and access/state denial; repository lint, TypeScript,
test suite and production build are required before delivery. Production UI
checks are read-only and do not change the Comeback schedule or draft.
`REVIEW_SOURCE_UNAVAILABLE`: no current external Code Review findings were
supplied; available review sources are static analysis, tests and self-review.

Rollback: revert this ERP app-only change. No database rollback is needed and
existing raffle or participant records are retained. Check list/participant
reads and permission denial after rollback. Colorway association, authoritative
80 USD price, publication and the email SQL gate remain separate dependencies.
