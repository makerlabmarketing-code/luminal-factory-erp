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
