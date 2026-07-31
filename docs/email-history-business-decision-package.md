# Email-history business-decision package

Status: **BUSINESS_DECISION_REQUIRED — NO RETENTION OR DELETION CHANGE IMPLEMENTED**  
Prepared: 2026-07-31

## Scope and current boundary

The admin history page reads `email_history` directly through the authenticated browser client. The current row shape used by the application is `id`, recipient, subject, group, rendered body, delivery status, sent time, and classified error code. The server mail path writes only `SUCCESS` or `FAILED`; it generates a correlation ID for server logs but does not persist it, and the provider message ID returned after a successful send is not written to history. The history UI currently exposes view and permanent delete operations. There is no repository-owned history-specific permission code, archive model, retry endpoint, retention job, deletion audit, or idempotency store.

This package recommends a contract but does **not** approve it. No irreversible schema, RLS, retention, archive, deletion, retry, runtime-flag, or live-email behavior is implemented here.

## Decision 1 — retention duration

| Item | Assessment |
| --- | --- |
| Current behavior | No repository retention rule or purge job exists; records remain until a user invokes the page's permanent delete action. Only `SUCCESS` and `FAILED` are currently written. |
| Risk unchanged | Ad hoc deletion loses operational evidence, while indefinite storage retains recipient addresses and rendered bodies without an approved need or predictable storage ceiling. There is no treatment for future `BOUNCED` or `PENDING` states. |
| Recommended option | Retain delivery/audit metadata for **24 months**. Retain rendered message bodies for **12 months**, then redact the body while preserving metadata. Preserve `FAILED`, future `BOUNCED`, and future unresolved `PENDING` records for 24 months or until 12 months after final resolution, whichever is later. Preserve `SUCCESS` metadata for 24 months. |
| Minimum safe option | **12 months** of metadata for resolved `SUCCESS`/`FAILED`; unresolved `PENDING` must never age out, and future `BOUNCED` should be retained at least 12 months after resolution. |
| Alternatives | Indefinite retention maximizes evidence but increases privacy/storage exposure. A uniform 12- or 24-month policy is simpler but fails to protect unresolved records specially. |
| Migration/runtime impact | Requires approved retention timestamps/status vocabulary, a body-redaction strategy, indexes for status/time, a scheduled server-side job, authorization, audit output, dry-run reporting, and rollback/restore procedures. |
| Reversible? | The policy and schedule are reversible before a purge. Body redaction and hard purge are irreversible unless an approved encrypted backup/restore path exists. |

## Decision 2 — deletion behavior

| Item | Assessment |
| --- | --- |
| Current behavior | The admin page can issue an immediate hard delete by row ID after browser confirmation. There is no reason, actor, audit record, recovery window, or repository permission dedicated to this action. |
| Risk unchanged | Accidental or unauthorized evidence loss, no accountability, and no way to distinguish housekeeping from concealment of a delivery failure. |
| Recommended option | Make **archive-only** the normal operator action. Do not expose user-initiated hard delete. Permit policy-driven hard purge only after retention expiry, from a trusted server job, with immutable purge audit metadata. Failed/bounced/pending records may not be purged before their resolution-specific retention expires. |
| Alternatives | Soft delete is recoverable but creates a second visibility state and can be confused with compliance erasure. Admin hard delete is simplest but is not recommended without exceptional approval and auditable break-glass controls. |
| Migration/runtime impact | Archive needs `archived_at`, `archived_by`, and `archive_reason` (or a separate immutable event table), query/RLS changes, server endpoints, and default exclusion/filtering. Purge needs a trusted scheduled boundary and aggregate evidence that excludes message content. |
| Reversible? | Archive and soft delete are reversible. Hard delete is not reversible without a backup restore. |

**Approval required:** explicitly choose archive-only, soft delete, or hard delete and decide whether the existing browser hard-delete action must be disabled immediately. This package leaves its semantics unchanged pending that choice.

## Decision 3 — authorization

| Item | Assessment |
| --- | --- |
| Current behavior | The browser queries rely on existing session/RLS behavior. The catalog defines only `EMAIL_TEMPLATE_VIEW` and `EMAIL_TEMPLATE_MANAGE`; it does not define history, retry, archive, or purge permissions. The admin test-send route currently requires `EMPLOYEE_MANAGE`, which is not an email-history contract. |
| Risk unchanged | Navigation/control visibility is not an authorization boundary. Reusing template or employee permissions conflates template authoring, employee administration, delivery evidence, and destructive actions. |
| Recommended option | Require `ADMIN_WORKSPACE` plus new least-privilege codes: `EMAIL_HISTORY_VIEW`, `EMAIL_HISTORY_RETRY`, and `EMAIL_HISTORY_ARCHIVE`. Reserve `EMAIL_HISTORY_DELETE` for an approved break-glass/service role only; do not grant it in ordinary presets. Template work continues to use `EMAIL_TEMPLATE_VIEW`/`EMAIL_TEMPLATE_MANAGE`. Enforce every operation in a server route/service and RLS, not only in the UI. |
| Alternatives | Reuse `EMAIL_TEMPLATE_VIEW` for viewing and `EMAIL_TEMPLATE_MANAGE` for retry/archive; this avoids catalog migration but grants broader powers than the names promise. Administrator-only access is simpler but prevents deliberate delegation and is harder to audit. |
| Migration/runtime impact | Permission catalog/grant migration, preset decision, server authorization service/routes, RLS review, permission-denied UI, and authorization fixture tests. |
| Reversible? | Permission assignments and route policy are reversible. Previously disclosed content or a completed deletion is not. |

Recommended role allocation: authorized administrators/auditors may view; designated email operators may retry one record; designated administrators may archive; only a separately approved break-glass operator or trusted retention job may permanently purge.

## Decision 4 — audit requirements

| Item | Assessment |
| --- | --- |
| Current behavior | History stores delivery fields and a classified failure code. It does not persist correlation ID, provider message ID, retry ancestry/count, archive/delete reason, actor, archive/delete timestamp, or original status. Browser deletion removes the source evidence itself. |
| Risk unchanged | A delivery incident cannot be joined reliably across UI, application logs, provider logs, retries, and destructive actions. |
| Recommended option | Require a non-empty controlled reason plus optional note; actor employee/auth ID; occurred-at timestamp; original delivery status; history ID; provider message ID when available; correlation ID; action (`ARCHIVE`, `RESTORE`, `PURGE`, `RETRY`); and retry parent/child IDs. Store append-only audit events separately from mutable history rows. Audit events must be immutable to ordinary operators and must survive history purge without recipient/body content unless specifically approved. |
| Alternatives | Columns on the history row are simpler but cannot represent multiple actions safely. General application audit logs may work only if their immutability, retention, access, and field contract are approved for email evidence. |
| Migration/runtime impact | New append-only event model or approved shared-audit integration, provider-message persistence, correlation persistence, RLS/GRANT design, server structured logging, and audit export/validation tests. |
| Reversible? | Adding evidence is reversible at runtime but removing it later is a governance decision. Immutability should intentionally prevent ordinary update/delete reversal. |

## Decision 5 — pagination and filtering

| Item | Assessment |
| --- | --- |
| Current behavior | Before this slice, the page selected every row and paginated/search-filtered in browser memory. This slice bounds reads with exact-count range pagination, a default of 10, maximum UI choice of 50, descending `id`, bounded search input, stale-response protection, and at most five rendered page buttons. Filters cover recipient, subject, and group. |
| Risk unchanged | Offset/range pagination can skip or duplicate records while new mail arrives; exact counts become expensive at high volume. Status/date/provider/correlation filters are absent. |
| Recommended option | Default **25**, maximum **100**, cursor pagination using `(sent_at, id)` descending, with an immutable tie-breaker. Filter by sent-time range, status, group/template, recipient, provider message ID, correlation ID, and archived state. Keep search server-side and length-bounded. |
| Alternatives | Keep offset pagination while volume is low; it supports direct page jumps and exact counts but becomes less stable/cost-effective. Keyset pagination by `id` alone is adequate only if `id` ordering is guaranteed to match the intended operational chronology. |
| Migration/runtime impact | The current safe bound requires no schema change. Cursor pagination needs a server endpoint/DTO, a composite index review, filter contract, and removal or redefinition of direct page jumps/exact totals. |
| Reversible? | Pagination/query behavior is reversible. Adding a non-unique index is normally reversible after load review. |

## Decision 6 — error handling

| Item | Assessment |
| --- | --- |
| Current behavior | The server send path classifies provider failures, uses Vietnamese controlled API messages, and logs correlation ID/outcome/failure code/template ID. Before this slice, the history page rendered raw Supabase error messages. It now shows controlled Vietnamese load/delete messages and logs only a machine code plus request or history ID. Correlation IDs are not persisted on history rows or shown for history query failures. |
| Risk unchanged | Without end-to-end persisted correlation, an operator cannot connect a history record to provider/server evidence. Browser console logging is not a durable observability boundary. |
| Recommended option | UI: `Không thể tải lịch sử email. Vui lòng thử lại.`; `Không thể gửi lại email. Vui lòng thử lại với mã hỗ trợ {id}.`; `Bạn không có quyền thực hiện thao tác này.` Never expose raw provider/Supabase messages. Generate/accept a correlation ID at the server boundary, return it on controlled failures, persist it with the attempt, and log `correlationId`, actor, operation, history/template ID, provider, outcome, classified failure code, duration, retry number, and safe recipient-domain/hash metadata. |
| Alternatives | Log correlation only without persistence (current send behavior) is lower impact but weakens incident joins. Persisting raw error text is rejected because it can contain infrastructure/provider details and recipient data. |
| Migration/runtime impact | Server history routes, shared error DTO, persisted correlation/provider fields, logging contract, redaction tests, and operational log-retention decision. |
| Reversible? | Controlled messaging/log fields are reversible. Disclosed raw errors cannot be recalled; collected logs require their own retention policy. |

Raw Supabase/provider objects must stop at the server/repository boundary. Store only approved classified codes; keep diagnostic details in restricted server logs with provider-specific redaction.

## Decision 7 — retry contract

| Item | Assessment |
| --- | --- |
| Current behavior | There is no history retry endpoint or UI. Test send is a separate one-recipient path. History lacks template/variables snapshot identifiers, retry lineage, idempotency key, retry count, cooldown, pending state, or provider message ID. |
| Risk unchanged | Adding a naive retry button could duplicate a successful delivery, send stale content, retry a permanent recipient failure, or allow concurrent double submission. The rendered body alone is not a safe reconstruction contract. |
| Recommended option | Allow **one-recipient retries only** for classified transient `FAILED` records and future resolved retryable `BOUNCED` records. Never retry `SUCCESS` or an in-flight `PENDING` record. Require a server-issued idempotency key unique to `(original_history_id, retry_number)`, a synchronous lock/unique constraint, one active attempt per original, maximum **3 retries in 24 hours**, cooldowns of **5 minutes, 30 minutes, then 6 hours**, and explicit operator confirmation. Create a new immutable attempt row linked to the original; never overwrite the original. |
| Alternatives | A fixed 15-minute cooldown is simpler. Batch retry is operationally faster but magnifies duplicate-send and authorization risk and should be a separately approved later capability. Automatic provider-driven retry requires a queue/worker and a more detailed failure taxonomy. |
| Migration/runtime impact | Business-approved retryable failure taxonomy, attempt lineage/idempotency schema, unique constraints/locking, provider-message/correlation persistence, server route/service, permissions, rate limits, UI state, and forced-concurrency regression tests. No live send should occur until the existing delivery runbook gate is separately approved. |
| Reversible? | Retry limits and cooldowns are reversible. A sent email cannot be recalled, and retry attempt evidence should remain immutable. |

## Approval checklist

No option below is approved by this document. Business/security owners must explicitly decide:

1. Metadata/body retention periods and status-specific exceptions.
2. Archive-only versus soft delete versus hard delete, including immediate treatment of the current hard-delete UI.
3. New history permission codes, preset grants, and break-glass ownership.
4. Audit owner/table, immutable fields, and audit retention after history purge.
5. Cursor versus offset pagination, direct-page/count needs, filters, and supporting index approval.
6. Persisted correlation/provider identifiers and restricted logging retention.
7. Retryable statuses/failure codes, limits, cooldown, idempotency, and whether retries must use original rendered content or a newly rendered approved template version.

## Safe repository-only changes in this slice

- Bounded the browser query to the requested page instead of loading the full table.
- Selected only fields currently rendered, bounded search length/syntax, and limited rendered pagination buttons.
- Prevented stale list responses and stale selected detail from surviving a refresh/page/filter change.
- Replaced raw Supabase error leakage with controlled Vietnamese messages and sanitized console metadata.
- Prevented concurrent delete submissions without altering the existing hard-delete semantics.

No SQL was executed; no production rows were inspected; no email was sent; no runtime flag or Vercel variable was changed; and no retention, deletion, RLS, permission, retry, or migration decision was implemented.
