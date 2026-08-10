# Monthly payroll cron boundary

Date: 2026-08-10

## Finding

`/api/cron/monthly-payroll` contained legacy capital-call email behavior rather than payroll settlement behavior. The route accepted unauthenticated GET requests and could send email to Admin/manager recipients whenever email delivery was enabled.

## Remediation

The legacy route is now fail-closed:

- GET returns HTTP 410.
- POST returns HTTP 410.
- responses are `Cache-Control: no-store`.
- the route no longer imports Supabase or email delivery code.
- no payroll settlement logic was introduced.
- no runtime flag was enabled.
- no database or business data was changed.

## Remaining payroll gate

The approved payroll settlement flow remains separate and must stay disabled until permission recipients and the first official settlement month are confirmed.
