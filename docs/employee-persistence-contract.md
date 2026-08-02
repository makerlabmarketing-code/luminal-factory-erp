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

## 2026-08-01 — Employee create failure diagnostic boundary

Production reported a generic create failure for a test-fixture attempt at
`/api/admin/employees` (correlation ID retained by the operator). The approved
read-only Admin readback and Vercel log-query procedures were not available in
the execution environment, so the result is classified `READBACK_UNAVAILABLE`;
the underlying database constraint is not inferred and no retry was performed.

Source review identified a concrete create-path defect: insert errors and missing
returned rows were collapsed into one generic `500`, no created employee ID was
returned, and the route did not attach a stable correlation ID to the create
action. The application repair maps safe duplicate, validation, permission,
dependency, and unexpected failures; performs only a read-only email readback
after an ambiguous response (never an automatic insert retry); returns the
created employee when available; and prevents synchronous double submission in
the Admin create dialog. Empty phone/title values remain nullable and facility
input remains canonicalized to a stable facility code. No production employee,
Auth identity, SQL, migration, or data repair was performed during this
investigation.

## 2026-08-02 — Employee create validation response boundary

Production returned the controlled `payload_validation_failed` response for the
LuminalQA fixture attempt (correlation ID retained by the operator). The
approved production log/readback path was unavailable, so the exact live
database column is not asserted and no production retry was performed. Source
inspection confirms the visible dialog payload is `fullName`, `email`, `title`,
`department` (canonical facility code), `phone`, and `employmentStatus`; empty
phone/title normalize to `null`, `ACTIVE` is the accepted status, and email is
stored normalized to lowercase.

The application now returns safe `fieldErrors` for server validation and maps
only sanitized constraint/column names to Vietnamese field messages. The dialog
marks true required fields, renders field-level errors, preserves entered
values, focuses the first reported field, rejects unknown create keys, and
retains the correlation ID in the summary. Raw database messages remain
server-only and are never returned to the browser.

## 2026-08-02 — Shared Employee create payload contract

The Admin create form and server action now use the same six-key request
contract: `fullName`, `email`, `title`, `department`, `phone`, and
`employmentStatus`. The exact LuminalQA reproduction payload (`ACTIVE`, blank
optional phone/title, and the selected facility's canonical code) passes the
shared payload parser before any persistence call. `department` remains a
stable facility code in browser requests; facility lookup and active-state
checks stay server-owned.

The reported response with `failureStage: validation` and no `fieldErrors`
cannot be reproduced from that exact payload in source. Before this slice,
database validation failures with an unmapped safe column/constraint reused the
same response code, omitted field details, and were mislabeled as validation
even after the database boundary. Those responses now use `core_mutation` when
the request reached Supabase and return a safe form-level error when a field
cannot be identified; known safe column names still map to field-level
Vietnamese errors. No production retry or readback was performed for the
reported correlation ID.

## 2026-08-02 — Employee create core-mutation diagnostic boundary

The `80aba6db-437f-4d03-afa2-74d6f379cb24` attempt passed the shared payload
contract and reached the `employees` insert. The browser payload keys and
values were valid by the tracked application contract; the server derived
`full_name`, normalized email, nullable `title`/`phone`, canonical
`branch_code`, `status`, `role=STAFF`, `is_active=true`, and
`auth_user_id=null` before persistence.

The repository does not register an approved Vercel production-log query
procedure, so the exact PostgreSQL code/constraint/column remains
`PRODUCTION_LOG_EVIDENCE_UNAVAILABLE`. No production retry or data readback was
performed. Employee create diagnostics now retain only an allowlisted table,
column, known constraint, machine error code, operation, stage, row count, and
readback-attempted flag; payload values and raw database details remain
excluded. Unknown constraint names do not drive public field mapping.

### Current Employee create insert matrix

| Insert column | Request/derived source | Incident value | Application normalization | Tracked contract evidence |
| --- | --- | --- | --- | --- |
| `full_name` | `fullName` | `Maker Lab` | trim; non-empty | required employee identity |
| `email` | `email` | `makerlab.marketing@gmail.com` | trim, lowercase, format check, duplicate precheck | required identity; uniqueness is checked before insert |
| `title` | `title` | `Tester` | trim; empty becomes `NULL` | nullable operational field |
| `phone` | `phone` | `NULL` | blank becomes `NULL`; non-blank format checked | nullable personal field |
| `branch_code` | `department` then facility directory | `X_NG_CH_NH_LUMINAL` | exact ID/code/name lookup; persists returned stable code | nullable employee assignment; no repository FK to `facilities` is established |
| `status` | `employmentStatus` | `ACTIVE` | uppercase allowlist `ACTIVE`/`INACTIVE` | active employee compatibility contract |
| `role` | server-derived | `STAFF` | never client-controlled | legacy role compatibility; exact database check remains unverified |
| `is_active` | server-derived | `true` | always true on create | active-state compatibility; exact database constraint remains unverified |
| `auth_user_id` | server-derived | `NULL` | invitation/linking is a separate action | nullable Auth link, evidenced by migration `20260712181332` |

The repository does not contain the original base `public.employees` table DDL;
tracked migrations add compatibility columns, policies, and constraints around
that pre-existing table. Therefore no production schema drift or rejecting
constraint is claimed without an approved log or metadata read.

## 2026-08-02 — Operator diagnostic evidence surface

Employee create persistence failures now retain a short-lived, deployment-local
diagnostic record keyed by the create correlation ID. An authenticated Admin with
`ADMIN_WORKSPACE` and `EMPLOYEE_MANAGE` may read one record through:

`GET /api/admin/employees/diagnostics/<correlationId>`

The response is `status=available` only when the record is present and returns
the timestamp, operation stage, normalized Postgres code, allowlisted table,
column, constraint, row-returned state, readback-attempted state, and safe error
category. Missing or expired records return `status=unavailable`; invalid IDs
are rejected. Responses are `Cache-Control: no-store` and never include the
employee payload, email, phone, title, raw database text, SQL, headers,
credentials, or environment values.

The cache is intentionally bounded to 100 records and 15 minutes and is local
to the serving deployment instance. It is an evidence aid, not durable audit
storage: a request routed to another serverless instance may correctly return
`unavailable`. Operators must retain only the correlation ID, timestamp, safe
response, and HTTP status. No production retry is implied by a diagnostic
record. Correlation IDs from failures that occurred before this endpoint was
deployed cannot be reconstructed or populated retroactively; they correctly
remain `unavailable`.

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
