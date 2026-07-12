# Batch 3C1-A/B/C Owner Bootstrap, system_settings Audit, and Drift Plan

Date: 2026-07-12

Scope: read-only verification and planning only. No migration repair, `db push`,
`migration up`, schema change, RLS/policy change, auth user creation, invite,
data change, bucket change, or application-code change was performed.

## 1. Owner Employee Match

Lookup rule used:

```sql
lower(trim(employees.email)) = lower(trim(<confirmed owner email>))
```

The confirmed email is not stored in application code and is not printed here in
full.

| Check | Result |
|---|---|
| Target owner | Tung Duy |
| Email display | `t***@g***.com` |
| Employee match count | `1` |
| Matched internal employee id | `3` |
| Email hash | `02ebdc98273a` |
| Existing employee role | `ADMIN` |
| Target bootstrap role | `OWNER` |
| Employee status | `ACTIVE` |
| Employee active flag | `true` |
| Matching auth user count | `0` |

Conclusion: Phase 3C1-A passes the "exactly one employee record" gate. No Auth
user exists yet, so Phase 3C2 can prepare an invite/admin-created account flow
after approval. Do not map by `full_name`.

## 2. system_settings Live Key Inventory

Values were not read or printed. Only key names, grouping metadata, value
presence, and value length were inspected.

| Key | Group | Current use classification | Target classification | Notes |
|---|---|---|---|---|
| `SMTP_HOST` | `EMAIL` | Server email config | Server-only | Required by `services/emailService.ts`; do not expose to browser. |
| `SMTP_PORT` | `EMAIL` | Server email config | Server-only | Required by `services/emailService.ts`; not secret but should travel with SMTP config. |
| `SMTP_USER` | `EMAIL` | Server email config | Server-only/sensitive | May identify sender account; do not expose in Client Component. |
| `SMTP_PASS` | `EMAIL` | Secret credential | Secret/server-only | Must not remain browser-readable. Prefer environment secret or approved privileged server-only storage. |
| `SMTP_FROM_NAME` | `EMAIL` | Server email display config | Server-only or admin-only readable | Can be less sensitive but should not justify broad table access. |
| `COMPANY_BANK_CODE` | `FINANCE` | Finance/VietQR config | Admin-only or server-mediated finance | Browser currently queries lowercase key, which conflicts with live uppercase key. |
| `COMPANY_BANK_ACCOUNT` | `FINANCE` | Finance/VietQR config | Admin-only or server-mediated finance | Sensitive enough to avoid broad public read. Browser currently queries lowercase key. |

No key is currently safe for broad anonymous write. No key is approved for public
browser read in this batch.

## 3. Application Dependency Map

| File | Boundary | Access | Keys/scope | Risk | Remediation dependency |
|---|---|---|---|---|---|
| `app/admin/settings/page.tsx` | Client Component | `select('*')`, `insert`, `update`, `delete`, inline bulk update | Entire `system_settings` table | Critical: browser can load and mutate SMTP credentials and finance settings through broad live policies. | Move to server route/action with authenticated Owner/Admin authorization before tightening policy. |
| `app/admin/capital/page.tsx` | Client Component | `select('value')` | `company_bank_code`, `company_bank_account` | High: direct browser read of finance config; current code key case does not match live uppercase keys. | Replace with server-mediated finance settings read or move values into non-secret server response after authorization. |
| `services/emailService.ts` | Server service | `select('key, value')` | All settings, then consumes SMTP keys | High: SMTP secret stored in table currently readable through broad policy. If policies are denied before replacement, email sending may break because server client is not privileged. | Move SMTP config to server-only env or approved privileged server-only settings reader before deny policy. |
| `services/workflowService.ts` | Server/service shape mapper | No direct `system_settings` query | Emits legacy `PRODUCTION_WORKFLOW`-like shape from project/phase/task tables | Low for `system_settings`; relevant to migration drift only. | No direct policy blocker found. |
| `supabase/migrations/20260704153000...` | Local migration draft/history | Reads/copies `system_settings` workflow rows | `PRODUCTION_WORKFLOW` | Drift evidence only; not live policy dependency. | Do not run as-is before drift reconciliation. |

## 4. Current Policy and Grant Evidence

Current policies:

| Policy | Role | Command | Predicate |
|---|---|---|---|
| `Allow anon all` | `anon` | `ALL` | `USING true`, `WITH CHECK true` |
| `Allow authenticated all` | `authenticated` | `ALL` | `USING true`, `WITH CHECK true` |

Current grants include `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`REFERENCES`, and `TRIGGER` for both `anon` and `authenticated`.

Impact: anonymous and authenticated callers can read and write settings while
these grants and policies remain in place.

## 5. Policy Target Matrix

| Actor | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `anon` | Deny by default | Deny | Deny | Deny | Public settings require a separate explicit allowlist or server route. |
| Authenticated staff | Deny by default | Deny | Deny | Deny | Staff should not read SMTP/finance settings. |
| Owner/Admin | Allow through server authorization or identity-aware policy | Allow only through authorized server/admin path | Allow only through authorized server/admin path | Allow only through authorized server/admin path | Requires `employees.auth_user_id` or approved privileged server route. |
| Server email service | Read SMTP only from server-only env or approved privileged server-only reader | N/A | N/A | N/A | Do not depend on browser-facing RLS access. |
| Finance UI | Read only needed bank display data through server-mediated route | N/A | N/A | N/A | Do not expose whole settings table. |

## 6. Draft SQL Artifacts

| Artifact | Purpose |
|---|---|
| `drafts/system-settings-policy-remediation-draft.sql` | Deny-by-default remediation draft with identity-aware admin policies commented until identity exists. |
| `drafts/system-settings-policy-rollback-draft.sql` | Emergency rollback to current broad policies. |

Important: the remediation draft should not be run before direct browser
dependencies and SMTP config dependency are fixed. Otherwise admin settings,
finance bank display, or email sending may break.

## 7. Regression and Security Test Matrix

| Test | Expected result |
|---|---|
| Anonymous REST read `system_settings` | Denied unless key is explicitly public allowlisted. |
| Anonymous REST insert/update/delete `system_settings` | Denied. |
| Authenticated staff read SMTP keys | Denied. |
| Authenticated staff write any setting | Denied. |
| Owner/Admin settings read through approved server path | Allowed after server auth check. |
| Owner/Admin settings write through approved server path | Allowed after server auth check and validation. |
| Browser bundle search for SMTP value/key material | No credential values; no service secret in client bundle. |
| Email send after remediation | Uses server-only SMTP config; no browser-readable settings dependency. |
| Capital page after remediation | Reads only approved finance display data through server-mediated path. |
| Direct API call bypassing UI | Denied without Owner/Admin authorization. |

## 8. Migration Drift Reconciliation Plan

Selected direction: live Supabase database is the current baseline, but the two
repository migrations are not assumed to represent full live history.

Do not run migration repair yet.

Recommended sequence:

1. Keep current local migrations untouched.
2. Produce object-by-object equivalence evidence for `20260704153000`:
   `projects`, `phases`, `tasks`, columns, FKs, indexes, grants, policies, and
   data-copy side effects.
3. Mark `20260704153000` as not equivalent in current evidence because live
   columns and policies differ.
4. Mark `20260709110000` as not equivalent because live `phases` lacks
   colorway/stage columns and index.
5. Decide whether to create a reviewed live-baseline migration artifact with
   `supabase db pull`, or create a reconciliation migration that moves live
   schema toward the intended repo/app schema.
6. Only after equivalence/reconciliation is approved, decide if any
   `supabase migration repair --status applied` is appropriate.

Current equivalence matrix:

| Version | Equivalence to live | Evidence | Repair readiness |
|---|---|---|---|
| `20260704153000` | Not proven; currently mismatch | Live workflow tables exist but column shapes and policies differ. | Not Ready |
| `20260709110000` | Not equivalent | Live `phases` lacks colorway/stage fields and index. | Not Ready |

## 9. Commands Draft for Later Approval

Read-only commands:

```bash
npx supabase migration list --linked
npx supabase db query --linked "<read-only validation SQL>"
```

Possible future baseline command, not run:

```bash
npx supabase db pull live_schema_baseline --linked
```

Possible future repair command, not currently recommended and not run:

```bash
npx supabase migration repair --linked --status applied 20260704153000
```

Do not repair `20260709110000` as applied while live `phases` lacks its columns
and index.

## 10. Readiness

| Area | Status | Reason |
|---|---|---|
| Owner bootstrap | Ready for approval to proceed to Phase 3C2 invite/admin-created flow | Exactly one employee matched by normalized email; auth user does not exist yet. |
| system_settings remediation | Not Ready to run policy SQL | Dependency map shows direct browser settings access and server SMTP table dependency. |
| Migration reconciliation | Not Ready to repair | Live baseline chosen, but object equivalence is not proven and both local migrations currently mismatch live. |
| Identity migration | Not Ready | Must wait for Owner Auth bootstrap and drift/reconciliation decision. |

## 11. Blocking Decisions

1. Approve Phase 3C2 invite/admin-created flow for employee internal id `3`.
2. Decide whether target Owner role should update `employees.role` from `ADMIN`
   to `OWNER` in a later approved data step.
3. Decide whether SMTP settings move to server-only environment variables or a
   privileged server-only settings reader.
4. Decide whether `COMPANY_BANK_CODE` and `COMPANY_BANK_ACCOUNT` should be
   visible to finance UI through a server-mediated route.
5. Decide live baseline strategy: `db pull` baseline first, or manual
   reconciliation migration first.

