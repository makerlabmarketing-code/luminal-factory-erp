# Permission argument shadowing — Production incident, 2026-11-02

Status: **PRODUCTION_APPLIED / POSTFLIGHT_PASS**. The owner separately approved
#249; migration `20261102065026_fix_permission_argument_shadowing` was applied
once and #249 merged at `788932f`. Read-only ledger confirmation repeated on
04/11. No permission rows or flags changed. The incident reproduction below is
historical; live browser-session acceptance remains open.

Hà retains ADMIN_WORKSPACE and 31 active ALLOW rows, plus one intentional ACCOUNT_MANAGE DENY. Production has_permission(text) binds the unqualified permission_code inside each employee_permissions subquery to its column, making both comparisons self-comparisons. A DENY for any permission therefore blocks every permission; without a DENY, any ALLOW can incorrectly satisfy an unrelated catalog permission. Application-side TypeScript checks compare the requested code correctly, producing inconsistent navigation and database results.

Read-only reproduction under authenticated role for Hà: can_access_admin=true; has_permission(EMPLOYEE_VIEW)=false; has_permission(ATTENDANCE_VIEW)=false; employees SELECT=1; attendance SELECT=0. This reproduces the Production runtime logs. No account role or permission rows have been changed.

Proposed fix replaces three ambiguous references with positional $1. Signature, parameter name, owner, stability, SECURITY DEFINER, search_path and existing grants remain unchanged. Existing definer is retained because the helper must evaluate protected permission rows for RLS; no elevated function is introduced. No schema tables, columns, indexes, data backfill, policies, business rules or feature flags change. No expected row changes or data loss. Forward guard requires the exact reviewed old body. Rollback restores the original function, including its bug, and should only be used for an unexpected regression.

Run fixtures.sql only on a disposable PostgreSQL database. It reproduces the old bug, applies the exact forward.sql, tests per-permission allow/deny, unknown and absent permissions, inactive and revoked rows, unlinked/inactive identities, and RLS staff/admin visibility. validation.sql compares the live helper to the intended rule for all linked employee/catalog pairs using transaction-local JWT subjects; expected result is no mismatches. Do not use it to establish browser-session acceptance. After approved deployment verify real Hà session and staff isolation.

QA-003 #248 is also deployed as `20261102061722_qa003_history_hardening`; read-only postflight passed. Do not reapply either package from these historical reproduction instructions.
