# ERP to Commerce Admin Integration Contract

**Status:** `LFC_HMAC_V1_COMPATIBILITY_PREPARED / RUNTIME_DISABLED`
**Contract version:** `2026-09-11`
**Signature profile:** `lfc-hmac-v1`
**First adapter:** Homepage Hero

## Decision

Luminal Factory ERP and Commerce remain separate Next.js applications with separate Supabase projects. Commerce is authoritative for persisted commerce state and public presentation. ERP is the operational administration surface.

ERP must not connect its browser, server-side Supabase client, or Supabase ERP project directly to the Commerce database. Commerce service-role credentials remain only in Commerce server code.

## Boundary

1. An ERP route or Server Action verifies the current Supabase ERP session.
2. ERP requires `ADMIN_WORKSPACE` and the operation-specific ERP Commerce capability.
3. A server-only ERP adapter maps that capability to an exact Commerce scope and sends a signed HTTPS request to the Commerce Management API.
4. Commerce verifies client/key identity, audience, HMAC, timestamp, durable nonce replay state and requested scope.
5. Commerce validates the input and performs the operation through its own privileged server boundary, Storage guard or RPC.
6. Commerce returns a bounded versioned response with the same request ID.

The ERP browser calls only ERP routes. It never receives the HMAC secret, signed machine headers or Commerce service-role key.

## `lfc-hmac-v1` authentication contract

The canonical request is newline-delimited in this exact order:

```text
signature-version
client-id
key-id
audience
request-id
timestamp
nonce
actor-id
workspace-id
scope
HTTP-method
request-path
content-type
body-sha256
```

ERP uses:

- signature version `lfc-hmac-v1`;
- HMAC-SHA256 encoded as lowercase hex;
- SHA-256 of the exact UTF-8 request body encoded as lowercase hex;
- integer Unix timestamp in seconds;
- exact content type `application/json`;
- signed route family `/api/admin/v1/`;
- one ERP-authenticated actor ID, configured workspace ID, audience and key ID;
- Commerce scopes rather than ERP permission codes in the signed envelope.

The prepared Homepage Hero scope mapping is:

- `COMMERCE_HOMEPAGE_HERO_VIEW` → `commerce.hero.read`;
- draft create/update with `COMMERCE_HOMEPAGE_HERO_MANAGE` → `commerce.hero.write`;
- publish/unpublish with `COMMERCE_HOMEPAGE_HERO_MANAGE` → `commerce.hero.publish`.

The ERP signer is tested against the shared TEST-ONLY Commerce compatibility vector. Production secrets are not part of the repository and the integration flag remains disabled.

## Signed headers

```text
X-Luminal-Signature-Version
X-Luminal-Client-Id
X-Luminal-Key-Id
X-Luminal-Audience
X-Luminal-Request-Id
X-Luminal-Timestamp
X-Luminal-Nonce
X-Luminal-Actor-Id
X-Luminal-Workspace-Id
X-Luminal-Scope
X-Luminal-Body-SHA256
X-Luminal-Signature
```

Commerce must reject invalid/unknown credentials, wrong audience, stale timestamps, replayed nonces, body-hash mismatch, invalid HMAC, unsupported scopes and route/scope mismatches. Durable replay protection, final authorization, audit and idempotency remain Commerce responsibilities.

## Homepage Hero management contract

| Operation | Method and path | ERP capability | Commerce scope |
|---|---|---|---|
| List presentations | `GET /api/admin/v1/homepage-hero` | `COMMERCE_HOMEPAGE_HERO_VIEW` | `commerce.hero.read` |
| Create draft | `POST /api/admin/v1/homepage-hero` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | `commerce.hero.write` |
| Update draft | `PATCH /api/admin/v1/homepage-hero/{id}` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | `commerce.hero.write` |
| Publish | `POST /api/admin/v1/homepage-hero/{id}/publish` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | `commerce.hero.publish` |
| Unpublish | `POST /api/admin/v1/homepage-hero/{id}/unpublish` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | `commerce.hero.publish` |

Every mutation carries a caller-generated `operationId`. Commerce owns durable idempotency; the request ID is tracing evidence and does not replace operation idempotency.

## Server-only ERP environment contract

Keep these server-only and never prefix them with `NEXT_PUBLIC_`:

- `COMMERCE_ADMIN_INTEGRATION_ENABLED=false` or unset by default;
- `COMMERCE_ADMIN_API_BASE_URL` as an HTTPS origin only;
- `COMMERCE_ADMIN_API_CLIENT_ID`;
- `COMMERCE_ADMIN_API_KEY_ID`;
- `COMMERCE_ADMIN_API_AUDIENCE`;
- `COMMERCE_ADMIN_API_WORKSPACE_ID`;
- `COMMERCE_ADMIN_API_HMAC_SECRET_BASE64`, canonical base64 encoding of at least 32 random secret bytes.

Production, Preview and local credentials must be distinct. Key rotation is coordinated with Commerce; ERP signs with the currently configured key while Commerce may accept a bounded current/previous overlap.

## Rollout gate

Keep `COMMERCE_ADMIN_INTEGRATION_ENABLED` false/unset until all of the following pass:

1. ERP signer passes the shared `lfc-hmac-v1` vector and negative tamper tests.
2. Commerce credential provisioning/rotation wiring is complete server-side.
3. Commerce's prepared Management API routes pass review and their remaining deployment/runtime gates; route implementation already exists (see the handoff below).
4. Commerce durable replay, audit and idempotency gates remain validated.
5. ERP adds reviewed routes/UI and the Commerce permission catalog/backfill decision is approved.
6. Unauthorized, stale, replay, tamper, rotation, idempotency and authorized non-production E2E smoke tests pass.
7. A separate Production activation approval is received.

## Current slice and non-goals

### 2026-09-13 cross-repository handoff (E-003)

Repository evidence: [Commerce `f22515d1`](https://github.com/makerlabmarketing-code/luminal-factory-commerce/tree/f22515d14e41778df286ac351aa251174e712a54), especially `specs/integration/commerce-admin-homepage-hero-route-plan.md` and `src/features/management/commerce-admin-route-runtime.ts`.

All five operations above have Commerce route implementations. The shared runtime verifies the raw-body `lfc-hmac-v1` signature, supports configured current/previous keys, checks route scopes and calls the durable nonce RPC. The default-disabled path returns `503 INTEGRATION_DISABLED`. Hero mutations use the Commerce-owned `manage_homepage_hero` RPC with operation-id receipts; repository code is not evidence of live database delivery or end-to-end readiness.

The Commerce Production migration ledger was read on 2026-09-28 and includes
`20260922031133_add_commerce_admin_hero_idempotency`. The private receipt table
and `public.manage_homepage_hero` RPC were also confirmed by read-only catalog
queries. The earlier repository-only status is superseded; do not reapply the
migration. The route runtime returns authentication/replay failures before
entering the authenticated audit context; denied-request audit persistence
remains a separate open gate.

The application routes/UI and asset upload-ticket boundary are now prepared.
Remaining order: distinct environment-specific credentials and denied-request
audit → reviewed ERP permission decision → retained non-production E2E evidence
→ separate Production activation approval. On 2026-09-28, Commerce had no
Supabase development branch for that E2E run.

Acceptance for E-003 is documentation alignment with these repository seams and remaining gates. It does not close #203, resume parked integration work, approve credentials or migrations, or establish a live PASS. The wire contract version stays `2026-09-11`.

The earlier compatibility slice changed the prepared signer/transport contract only. E-003 changes documentation only. Neither adds an ERP browser route or Commerce-management UI, performs a real ERP→Commerce request, creates a real HMAC secret, changes Supabase schema or Production data, or enables a runtime flag.

Rollback is a code/document revert. There is no database rollback and no data-loss risk.

## 2026-09-26 — ERP Homepage Hero Manager consumer slice

The business owner resumed Homepage Hero administration after the Commerce
publish-guard and Storage asset gates passed.

ERP now owns an internal control-plane route family under
`/api/admin/commerce/homepage-hero`. The browser still does not receive the
shared HMAC secret, machine signature headers or a Commerce service-role key.

The Homepage Hero contract also includes:

| Operation | Commerce method and path | ERP capability | Commerce scope |
|---|---|---|---|
| List assets | `GET /api/admin/v1/homepage-hero/assets` | `COMMERCE_HOMEPAGE_HERO_VIEW` | `commerce.hero.read` |
| Create signed upload ticket | `POST /api/admin/v1/homepage-hero/assets/upload-ticket` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | `commerce.hero.write` |

Binary upload is the narrow exception to the normal browser control-plane
rule: the ERP browser may PUT the selected GLB/poster bytes directly to the
time-limited, path-scoped Supabase Storage signed URL returned through the ERP
server route. The browser does not receive a Commerce database credential or
service-role key, and every draft/publish mutation still goes through the ERP
server signer and Commerce Management API.

The admin UI is available at `/admin/commerce/homepage-hero` and provides:

- Hero list and draft selection;
- GLB/poster asset selection;
- signed asset upload;
- isolated 3D preview using the same pinned model-viewer runtime family as Commerce;
- camera, exposure, shadow and rotation settings;
- explicit save-draft, publish and unpublish actions.

The integration flag remains false by default. With
`COMMERCE_ADMIN_INTEGRATION_ENABLED` disabled, live Commerce operations fail
closed and the UI exposes a Vietnamese disabled state.

Permission catalog/backfill is intentionally not included in this slice.
System OWNER retains protected full access through the existing authorization
rule. Non-owner Commerce capability rollout remains a separate reviewed
permission-catalog decision before Production activation.

Rollback is an application-code revert of the ERP route/UI/contract additions.
No ERP schema migration, Commerce data mutation, HMAC credential provisioning
or runtime activation belongs to this slice.
