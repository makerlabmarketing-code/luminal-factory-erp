# Facility and Employee Production Compatibility Audit

## Audit status

`PRODUCTION_READ_ACCESS_UNAVAILABLE` in this Cloud environment on 2026-07-27. The Supabase URL is configured, but no publishable/anon key, server secret key, access token, database password, or authenticated Supabase MCP resource is available. No production query, SQL mutation, Auth mutation, deployment, or data mutation was attempted.

Run the exact read-only audit from Codespaces:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/validation/20260727_facility_employee_compatibility_audit.sql \
  | tee /tmp/facility-employee-compatibility-audit.txt
```

The SQL starts `begin transaction read only` and ends with `rollback`. Do not paste credentials or employee/Auth records into the report.

## Current contract from repository evidence

| Business field | Actual source table/column | Nullable | Example value | Used by employee | Used by attendance |
|---|---|---:|---|---:|---:|
| Facility primary key | `public.facilities.id` | No | `1` | Compatibility match against `employees.branch_code` | Compatibility match |
| Stable facility code | `public.facilities.code` after the delivered migration; live presence requires audit | No after migration | `CN1` | Preferred persisted assignment value | Compatibility match |
| Facility name | `public.facilities.facility_name` | Yes in the application compatibility contract | `Chi nhánh …` | Display and legacy-name match | Display and legacy-name match |
| Address | `public.facilities.address` | Yes | Redacted in this report | No | Administrative display |
| Latitude | `public.facilities.lat` | Yes | Decimal | No | GPS distance validation |
| Longitude | `public.facilities.lng` | Yes | Decimal | No | GPS distance validation |
| Safe radius | `public.facilities.radius` | Yes | Metres | No | GPS distance validation |
| Active state | `public.facilities.is_active` after the delivered migration; live presence requires audit | No after migration | `true` | Limits new assignment choices | Limits active attendance matching |
| Employee facility assignment | `public.employees.branch_code` | Yes | `CN1`, `3`, `1` (production symptoms supplied by operator) | Authoritative current stored value | Assigned-facility input |
| Auth mapping | `public.employees.auth_user_id` | Yes | Redacted UUID | Account enrichment only | Current employee identity boundary |

The repository contract does not establish a database foreign key from `employees.branch_code` to `facilities`. The application therefore resolves the value narrowly in this order: exact facility ID, exact stable code, exact facility name, then a display-only unresolved legacy state. Numeric values that cannot be resolved are never displayed as raw IDs.

## Diagnosed application failures

The production-visible list failure had an application-side cause: the authorized
`/api/admin/facilities` request delegated its read to `getFacilityDirectoryResult`,
which always constructed a privileged client and therefore made
`SUPABASE_SECRET_KEY` a hidden requirement. Employee core reads use the request
session and survived because facility/account enrichment errors are intentionally
captured; the Facility page treated the same directory error as fatal. The list and
Employee enrichment now query with the already-authorized request-scoped client.
Production RLS/grant compatibility is still unverified and is the remaining database
gate, not a reason to restore the secret-dependent read.

1. The facility page's client parser compared `message` with the machine error code, so `facility_schema_unavailable` could not be classified correctly. The corrected route/parser preserves server codes and adds retry metadata.
2. Legacy facility rows were previously assigned a fake display code equal to their numeric ID. Legacy rows now keep an empty code and disable code/status persistence capability instead of pretending the schema supports it.
3. Employee facility display previously returned the stored `branch_code` whenever enrichment did not resolve it, exposing raw numeric IDs. One server resolver now returns structured resolution status and a safe display value.
4. `Lỗi liên kết` previously meant any `auth_user_id` with no Auth user in the batch result, including a failed Auth batch request. Temporary lookup failures now display `Chưa tải được trạng thái tài khoản`; missing users, email mismatch, and duplicate mappings are distinct. `Lỗi liên kết` is reserved for a confirmed duplicate mapping.
5. Employee Detail previously put core employee, facility, access, project membership, and account reads in one rejecting `Promise.all`. It now completes the core employee query first and converts each optional enrichment failure into a partial-profile warning.

## Reconciliation decision

No data mutation is part of this slice. After the read-only audit, a separate reviewed reconciliation may be required for values that do not match a facility ID, code, or name. Never rewrite `employees.branch_code` automatically: numeric and textual legacy values must be mapped with business confirmation to avoid attaching an employee to the wrong facility.

## Operator order for the Facility Directory read boundary

Keep `FACILITY_ACTIVE_STATE_ENABLED=false`/unset throughout this sequence.

1. Run `supabase/validation/20260727_facility_employee_compatibility_audit.sql` read-only and retain the redacted schema, FK, aggregate assignment, grant, and policy output.
2. Run `supabase/drafts/20260728_facility_directory_rls_pre_run.sql` read-only. If an equivalent scoped SELECT policy and grant already exist, do not run the forward draft; compare and record the existing policy instead.
3. Obtain live approval for the reviewed RLS change. Only then run `supabase/drafts/20260728_facility_directory_rls_forward.sql` if the pre-run proves it is required.
4. Run `supabase/drafts/20260728_facility_directory_rls_post_run.sql`, then perform every authorized/unauthorized smoke fixture listed in that file.
5. Confirm migration history and run `supabase/validation/20260723120000_facility_status_code_validation.sql`; do not rerun the tracked `20260723120000_facility_status_code.sql` outside the approved migration path.
6. Verify the Facilities page, Employee list/detail legacy values, assigned-facility Attendance lookup, and inactive exclusion. Do not enable the flag until all evidence is PASS.
7. If the new read boundary causes authorization exposure or regression, run `supabase/drafts/20260728_facility_directory_rls_rollback.sql`. Use the existing status/code rollback only for a separately approved status/code rollback decision.

## Request behavior

| Workflow | Before | After |
|---|---:|---:|
| Employee list initial browser request | Server render; no duplicate client fetch | Server render; no duplicate client fetch |
| Employee list Retry | 1 employee API request | 1 employee API request |
| Facility list initial load | 1 facility API request | 1 facility API request |
| Facility Retry | 1 facility API request | 1 facility API request |
| Auth enrichment for five employees | One paginated server batch, not one request per employee | One paginated server batch, not one request per employee |
| Employee Detail | Core and five enrichments in one rejecting group | 1 core read, then five independent parallel enrichment reads; failures do not refetch core automatically |

Facility schema fallback adds exactly one second database query only after PostgreSQL/PostgREST reports a known missing-column error. Permission, RLS, configuration, and network failures do not activate fallback.
