# Employee persistence contract and production incident

## Incident closure

**Status:** `EMPLOYEE_PROFILE_PERSISTENCE_PASS` — **CLOSED** (operator-verified in production on 2026-07-29).

Authenticated production smoke verified that Admin profile updates persist through navigation and hard refresh while omitted fields remain unchanged. It also verified that Staff phone and bank updates persist through navigation and hard refresh and target only the authenticated employee. Success and error notifications remained isolated to the active workspace. No SQL, RLS broadening, or runtime flag change was required.

## Historical diagnostic boundary

The execution environment did not expose Vercel production logs for correlation IDs
`5fde5ba6-848c-4309-963d-08b33e1574fd` and
`13baec06-b476-4102-a11c-5106c3f441be`. The generic responses therefore do not
prove a specific PostgreSQL error code. Current-main inspection does prove that both
failing writes converged on `createSupabaseAdminClient()`, while successful profile
reads used the authenticated request client. The privileged client accepted only
`SUPABASE_SECRET_KEY`; production environments retaining the established
`SUPABASE_SERVICE_ROLE_KEY` contract could consequently lose both write paths.

The server now accepts either server-only key name, preferring `SUPABASE_SECRET_KEY`.
No key is exposed to browser code. Sanitized structured logs record route, method,
actor employee ID, authorization result, failure stage, operation, relation, whether
the mutation ran, and only the Supabase machine error code. The original correlation IDs were not bound to an exact database error. That historical diagnostic limitation does not keep the incident open because the repaired contract has now passed authenticated production mutation and readback smoke tests.

## Authoritative employee source

`public.employees` is the sole profile source of truth for both Admin and Staff.

| Business value | Column | Write authority |
| --- | --- | --- |
| Employee primary key | `id` | System |
| Auth identity link | `auth_user_id` | Account administration |
| Name | `full_name` | Admin |
| Email | `email` | Admin |
| Phone | `phone` | Admin or the same authenticated employee |
| Job title | `title` | Admin |
| Employment status | `status` | Admin |
| Active compatibility state | `is_active` | Admin lifecycle |
| Canonical facility assignment | `branch_code` | Admin |
| Bank name | `bank_name` | The same authenticated employee |
| Bank account number | `bank_account_number` | The same authenticated employee |

There is no profile write to `profiles`, `phone_number`, `bank`, `account_number`,
`facility_id`, or `department`. `department` is only the Admin API input name and is
validated and converted to a canonical facility code before writing `branch_code`.
Legacy facility values remain readable; new assignments use canonical codes.

## Persistence and readback behavior

- Admin and Staff persistence/readback use the same `public.employees` contract.
- Admin patches contain only dirty fields; omitted fields are preserved.
- Staff patches accept only `phone`, `bankName`, and `bankAccountNumber`, resolve the
  session through `employees.auth_user_id`, and update exactly `employees.id`.
- Core mutation and readback are separate operations. A committed mutation is not
  reported as failed merely because later readback is unavailable; the response uses
  the pre-mutation core row merged with the validated patch and emits a warning.
- Staff responses use the same three `employees` columns used by authenticated GET/
  server rendering, then invalidate `/staff` and `/staff/profile`.
- Facility lookup is optional enrichment. A valid stored `branch_code` remains visible
  when directory enrichment is unavailable instead of being shown as unassigned.

## Mutation outcome contract

Mutation success is separate from optional enrichment and readback warnings. A successful core `public.employees` update remains successful if later optional facility/Auth enrichment or readback fails; the response returns the known core row and validated patch and reports the optional warning without replacing success.

## Database decision

No SQL is included or executed. Repository evidence already establishes all required
employee columns, and this incident was handled as an application privileged-client,
mutation/readback, cache, and diagnostic-boundary repair. Authenticated production
smoke has passed, so the Employee Profile persistence incident is closed.
