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
3. Commerce live Management API routes are implemented and reviewed.
4. Commerce durable replay, audit and idempotency gates remain validated.
5. ERP adds reviewed routes/UI and the Commerce permission catalog/backfill decision is approved.
6. Unauthorized, stale, replay, tamper, rotation, idempotency and authorized non-production E2E smoke tests pass.
7. A separate Production activation approval is received.

## Current slice and non-goals

This compatibility slice changes the prepared signer/transport contract only. It adds no ERP browser route or Commerce-management UI, performs no real ERP→Commerce request, creates no real HMAC secret, changes no Supabase schema or Production data and enables no runtime flag.

Rollback is a code/document revert. There is no database rollback and no data-loss risk.
