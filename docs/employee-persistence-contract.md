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

## 2026-08-03 — Authoritative same-response diagnostic surface

Production correlation ID `71b10315-5d73-4c16-9f5b-ee5d39c1538b` proved the
correlation lookup design could return `employee_diagnostic_unavailable`. The old
15-minute, 100-entry `globalThis` map was process- and instance-local,
non-durable, not shared between serverless requests, and lost on cold start or
deployment. Vercel may route the create POST and diagnostic GET to different
instances, so lookup could legitimately fail immediately. Increasing its TTL or
size would not correct instance locality.

The separate `GET /api/admin/employees/diagnostics/<correlationId>` endpoint and
its in-memory store are removed. The authoritative diagnostic is now constructed
inside the same authorized create request that receives the Supabase/PostgREST
failure and returned as `diagnostic` beside the safe code, stage, field errors,
and correlation ID. It contains only `available`, `operationStage`, normalized
`databaseCode`, allowlisted `table`, `column`, and `constraint`, `rowReturned`,
`readbackAttempted`, and allowlisted `category`. Every unknown string becomes
`unavailable`. Raw message/detail/hint, SQL, stack, request values, employee
identity/contact data, facility labels, credentials, headers, and environment
values cannot enter this response type.

`createEmployee` authorizes `ADMIN_WORKSPACE` plus `EMPLOYEE_MANAGE` before
parsing/persistence and before any diagnostic is constructed. Unauthenticated,
Staff, public, or permission-denied requests therefore receive their controlled
authorization failure without a diagnostic. There is no public lookup endpoint,
shared diagnostic persistence, database table, migration, or external store.

Insert constraints are reported as `employee_insert_constraint_failed` at
`employee_insert`; unexpected insert failures use `employee_insert_failed`;
known dependency/schema failures use `employee_persistence_unavailable` (503).
Readback is classified separately as `employee_insert_readback`; an ambiguous
outcome uses `employee_result_uncertain` and instructs the Admin to search by the
exact normalized email before any separately approved retry. The service still
performs only read-only email recovery after ambiguity, returns the created ID
when one exact row proves success, and never retries the insert automatically.

This same-response contract is complete, but the later schema-preflight section
supersedes the former immediate-retry instruction. Employee creation is **not**
marked fixed. Do not retry until the read-only metadata gate is approved and its
evidence is reviewed.

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

## Historical Employee profile database decision

No SQL was included or executed for the earlier Employee **profile update** incident.
Authenticated update smoke passed, so that update incident remains closed. This does
not establish the base-table contract for Employee **creation**; the following
read-only preflight boundary owns the still-open create incident.

## 2026-08-03 — Employee create schema preflight and stage reconciliation

**Next boundary:** `LIVE_APPROVAL_REQUIRED` for read-only production metadata inspection.

The create call still uses one PostgREST request, `insert(...).select(...).single()`.
PostgreSQL constraint codes (`23502`, `23503`, `23505`, `23514`) prove that the
statement was rejected and are classified as `employee_insert`. `PGRST116`, a
missing returned representation, a transport failure, or a failed exact-email
recovery cannot prove whether the row committed; these paths are classified as
`employee_insert_readback` with `resultUncertain=true`. A schema-cache error is
an insert-boundary schema failure, not a payload failure. There is currently no
post-insert processing or Employee audit write in this create path, so the
`employee_post_insert_processing` and `employee_audit_write` stages are reserved
but are not emitted. The insert is never retried automatically.

The same authorized POST response now uses these public codes:
`employee_payload_validation_failed`, `employee_duplicate_conflict`,
`employee_insert_constraint_failed`, `employee_insert_failed`,
`employee_insert_readback_failed`, `employee_result_uncertain`, and
`employee_schema_unavailable`. Safe diagnostics additionally expose
`resultUncertain`; PostgreSQL/PostgREST codes map to an allowlisted category and
unknown values normalize to `unavailable`.

### Complete insert schema expectation matrix

The original `public.employees` DDL is not tracked. “Inferred” below means the
application reads or writes the shape, not that production metadata proves it.

| Insert column | Source / normalized value | JavaScript type | Expected database type | Required / default | Tracked constraints / references | Trigger dependency | DDL evidence | Confidence |
|---|---|---|---|---|---|---|---|---|
| `full_name` | `fullName`; trimmed, non-empty, max 160 | `string` | text-like | application-required; DB nullability/default unknown | no tracked base check/unique/FK | none tracked | original DDL absent | inferred |
| `email` | `email`; trimmed, lowercase, format-checked | `string` | text-like | application-required; DB nullability/default unknown | application exact-email duplicate check; DB unique name unknown | none tracked | original DDL absent | inferred |
| `title` | `title`; trimmed or `null` | `string \| null` | text-like | nullable assumed; default unknown | none tracked | none tracked | original DDL absent | inferred |
| `phone` | `phone`; punctuation removed, validated, or `null` | `string \| null` | text-like | nullable assumed; default unknown | application format check only | none tracked | original DDL absent | inferred |
| `branch_code` | `department`; facility lookup returns canonical code, or `null` | `string \| null` | text-like | nullable assumed; default unknown | no tracked Employee-to-Facility FK; reference behavior is application-owned | none tracked | original DDL absent | inferred |
| `status` | `employmentStatus`; uppercase `ACTIVE`/`INACTIVE` | `string` | text/enum-like | application-required; DB default unknown | application allowlist; live check unknown | none tracked | original DDL absent | inferred |
| `role` | server constant `STAFF` | `string` | text/enum-like | supplied; DB default unknown | live check/enum unknown | none tracked | original DDL absent | inferred |
| `is_active` | server constant `true` | `boolean` | boolean | supplied; DB default unknown | no tracked check | none tracked | original DDL absent | inferred |
| `auth_user_id` | server constant `null`; account linking is separate | `null` | UUID | nullable is proven by the tracked add-column migration | tracked FK to `auth.users(id)` and partial unique constraint | none tracked | `20260712181332_add_employee_auth_user_id.sql` | proven for this column only |

Potential unsupplied requirements (`employee_code`, `created_by`/`updated_by`,
workspace/tenant ownership, audit provenance, `created_at` without a default,
branch ID, mandatory Auth linkage, and trigger-populated values) are **not claimed
to exist**. The read-only preflight enumerates every live non-null/no-default
column, constraint, foreign key, trigger, policy, grant, and relevant fixture
predicate so the operator can prove or reject those possibilities.

### Read-only preflight package

- Preflight: `supabase/drafts/20260803_employee_create_schema_preflight.sql`
- Interpretation checks: `supabase/validation/20260803_employee_create_schema_preflight_validation.sql`
- Expected row impact: `0`; both scripts begin a read-only transaction and roll back.
- Expected schema impact: none.
- Prerequisites: an approved Supabase SQL Editor session or read-only/metadata-capable
  `psql` session; do not use an application service key in a browser or retain row data.
- Execution order: preflight, retain redacted output, validation, retain redacted output,
  then stop for technical review. No forward or rollback correction exists because the
  exact defect is not yet proven.
- Rollback condition: not applicable; stop immediately if either script attempts a
  mutation, metadata access is denied, a referenced relation is absent, or output
  contains unexpected sensitive data.
