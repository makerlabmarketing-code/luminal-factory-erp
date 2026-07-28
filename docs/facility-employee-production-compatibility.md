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

1. The facility page's client parser compared `message` with the machine error code, so `facility_schema_unavailable` could not be classified correctly. The corrected route/parser preserves server codes and adds retry metadata.
2. Legacy facility rows were previously assigned a fake display code equal to their numeric ID. Legacy rows now keep an empty code and disable code/status persistence capability instead of pretending the schema supports it.
3. Employee facility display previously returned the stored `branch_code` whenever enrichment did not resolve it, exposing raw numeric IDs. One server resolver now returns structured resolution status and a safe display value.
4. `Lỗi liên kết` previously meant any `auth_user_id` with no Auth user in the batch result, including a failed Auth batch request. Temporary lookup failures now display `Chưa tải được trạng thái tài khoản`; missing users, email mismatch, and duplicate mappings are distinct. `Lỗi liên kết` is reserved for a confirmed duplicate mapping.
5. Employee Detail previously put core employee, facility, access, project membership, and account reads in one rejecting `Promise.all`. It now completes the core employee query first and converts each optional enrichment failure into a partial-profile warning.

## Reconciliation decision

No data mutation is part of this slice. After the read-only audit, a separate reviewed reconciliation may be required for values that do not match a facility ID, code, or name. Never rewrite `employees.branch_code` automatically: numeric and textual legacy values must be mapped with business confirmation to avoid attaching an employee to the wrong facility.

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
