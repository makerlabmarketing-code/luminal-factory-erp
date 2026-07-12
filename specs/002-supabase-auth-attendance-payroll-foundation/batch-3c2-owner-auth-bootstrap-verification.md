# Batch 3C2 Owner Auth Bootstrap Verification

Date: 2026-07-12

Scope: read-only verification and draft artifacts only. No SQL migration was
run, no schema was changed, no employee record was updated, no migration repair
was run, no RLS was changed, no auth user was created by Codex, no invite was
sent by Codex, and no application code was changed.

## 1. Verification Result

Lookup rule:

```sql
lower(trim(auth.users.email)) = lower(trim(<confirmed owner email>))
lower(trim(employees.email)) = lower(trim(<confirmed owner email>))
```

The confirmed email is not printed in full in this report.

| Check | Result |
|---|---|
| Email display | `t***@g***.com` |
| Email hash | `02ebdc98273a` |
| Auth user match count | `1` |
| Auth user id prefix | `a6618a57...` |
| Auth user id hash | `f27b06f2078a` |
| Auth user created | Yes |
| Invite metadata present | Yes |
| Email confirmed metadata present | Yes |
| Confirmed metadata present | Yes |
| Last sign-in metadata present | Yes |
| Employee match count | `1` |
| Employee internal id | `3` |
| Employee current role | `ADMIN` |
| Target role | `OWNER` |
| Employee status | `ACTIVE` |
| Employee active flag | `true` |
| `employees.id` exists | Yes |
| `employees.auth_user_id` exists | No |
| Duplicate auth email for target | None found |
| Duplicate employee email for target | None found |

## 2. Readiness

| Area | Status | Reason |
|---|---|---|
| Auth user readiness | Ready | Exactly one Auth user exists for the normalized owner email. |
| Invite acceptance | Ready | `invited_at`, `confirmed_at`, `email_confirmed_at`, and `last_sign_in_at` metadata are present. |
| Employee match readiness | Ready | Exactly one employee row matches the same normalized email. |
| Mapping confidence | High | Auth and employee rows share the same normalized email hash; no duplicate groups found. |
| Identity schema readiness | Draft Ready, Not Applied | `employees.auth_user_id` does not exist yet; migration draft prepared only. |

## 3. Mapping Proposal

Canonical path after migration/backfill:

```text
auth.users.id
-> employees.auth_user_id
-> employees.id = 3
```

The full `auth.users.id` is intentionally not stored in the report. Backfill
drafts use a placeholder that must be substituted from a secure operator channel
after approval.

## 4. Draft Artifacts

| Artifact | Purpose |
|---|---|
| `drafts/owner-auth-user-id-migration-draft.sql` | Adds nullable `employees.auth_user_id`, FK to `auth.users(id)`, and partial unique index. |
| `drafts/owner-auth-user-id-backfill-draft.sql` | Backfills only employee internal id `3` after safety checks. |
| `drafts/owner-auth-user-id-validation-draft.sql` | SELECT-only validation that masks email and auth user ID. |
| `drafts/owner-auth-user-id-rollback-draft.sql` | Rolls back only the Owner backfill for employee id `3`; schema rollback remains optional/commented. |

## 5. Blocking Questions

1. Approve creating the actual migration under `supabase/migrations` for
   `employees.auth_user_id`.
2. Approve the secure substitution method for `<OWNER_AUTH_USER_ID>` during the
   one-record Owner backfill.
3. Decide whether changing `employees.role` from `ADMIN` to `OWNER` is part of
   Batch 3C3 or deferred until the broader role model is implemented.

