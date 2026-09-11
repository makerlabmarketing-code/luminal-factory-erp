# ERP to Commerce Admin Integration Contract

**Status:** `PREPARED_DISABLED`
**Contract version:** `2026-09-11`
**First adapter:** Homepage Hero

## Decision

Luminal Factory ERP and Commerce remain separate Next.js applications with separate Supabase
projects. Commerce is authoritative for persisted commerce state and public presentation.
ERP is the operational administration surface.

ERP must not connect its browser, server-side Supabase client, or Supabase ERP project directly
to the Commerce database. Commerce service-role credentials remain only in Commerce server code.

## Boundary

1. An ERP route or Server Action verifies the current Supabase ERP session.
2. ERP requires `ADMIN_WORKSPACE` and the operation-specific Commerce capability.
3. A server-only ERP adapter sends a signed HTTPS request to the Commerce Management API.
4. Commerce verifies client identity, signature, timestamp, nonce replay and capability.
5. Commerce validates the input and performs the operation through its own service-role client,
   Storage boundary or privileged RPC.
6. Commerce returns a versioned response envelope with the same request ID.

The ERP browser calls only ERP routes. It never receives the HMAC secret or Commerce service-role
key and never calls the Commerce Management API directly.

## Authentication and authorization

The prepared transport uses `LFM-HMAC-SHA256`. The canonical signature covers:

- contract version, HTTP method and path;
- timestamp, nonce and request ID;
- ERP client ID;
- verified ERP Auth subject and stable employee ID;
- required capability;
- SHA-256 request-body digest.

Commerce must reject requests with an invalid signature, unknown client ID, stale timestamp,
replayed nonce, mismatched body digest, unsupported contract version or disallowed capability.
Nonce replay protection must use a durable Commerce-owned store with a bounded retention window;
an in-memory set is insufficient across Vercel instances.

ERP capabilities prepared for the first adapter are:

- `COMMERCE_HOMEPAGE_HERO_VIEW`
- `COMMERCE_HOMEPAGE_HERO_MANAGE`

They are intentionally not added to the current permission-editor catalog in this slice. The
existing server policy grants requested capabilities to the protected system Owner; every other
account remains denied until a later reviewed permission-catalog/backfill slice.

## Generic response envelope

Successful response:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "contractVersion": "2026-09-11",
    "requestId": "same-as-request"
  }
}
```

Failure response:

```json
{
  "ok": false,
  "error": {
    "code": "STABLE_COMMERCE_ERROR_CODE",
    "message": "Safe user-facing message",
    "retryable": false
  },
  "meta": {
    "contractVersion": "2026-09-11",
    "requestId": "same-as-request"
  }
}
```

Raw database errors, stack traces, credentials and internal Supabase identifiers must not cross
the boundary.

## Homepage Hero management contract

| Operation | Method and path | ERP capability | Commerce responsibility |
|---|---|---|---|
| List presentations | `GET /api/management/v1/homepage-hero` | `COMMERCE_HOMEPAGE_HERO_VIEW` | Return drafts and published presentation for authorized administration |
| Create draft | `POST /api/management/v1/homepage-hero` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | Validate and insert inactive draft |
| Update draft | `PATCH /api/management/v1/homepage-hero/{id}` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | Reject unsafe paths and enforce editable state |
| Publish | `POST /api/management/v1/homepage-hero/{id}/publish` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | Verify Storage assets and call the Commerce-owned atomic publish RPC |
| Unpublish | `POST /api/management/v1/homepage-hero/{id}/unpublish` | `COMMERCE_HOMEPAGE_HERO_MANAGE` | Call the Commerce-owned unpublish RPC |

Every mutation carries a caller-generated `operationId`. Commerce owns idempotency persistence;
the ERP request ID is for tracing and does not replace mutation idempotency.

The current Commerce `master` schema already owns `homepage_hero_presentations`, the public
active-only read policy, Storage asset guards, `publish_homepage_hero(uuid)` and
`unpublish_homepage_hero(uuid)`. The future Commerce Management API must wrap these objects rather
than let ERP duplicate their database contract.

## Server-only ERP environment contract

- `COMMERCE_ADMIN_INTEGRATION_ENABLED=false` or unset by default;
- `COMMERCE_ADMIN_API_BASE_URL` as an HTTPS origin only;
- `COMMERCE_ADMIN_API_CLIENT_ID` as the allowlisted ERP service identity;
- `COMMERCE_ADMIN_API_HMAC_SECRET` as a distinct secret of at least 32 characters.

None of these variables use the `NEXT_PUBLIC_` prefix. The HMAC secret must be different from all
Supabase, SMTP, Turnstile, cart and Auth secrets.

## Reuse for later Commerce modules

Products, variants, collections, raffles, commissions, customers, orders and fulfillment add a
module contract and server adapter on top of the same signed transport. They reuse actor evidence,
capability checks, request signing, timeout, response-size limit, response envelope and error
normalization. Module code does not reproduce those responsibilities.

## Rollout gate

Keep `COMMERCE_ADMIN_INTEGRATION_ENABLED` false/unset until all of the following pass:

1. Commerce implements the management route with request-schema validation.
2. Commerce implements constant-time HMAC verification, timestamp tolerance and durable nonce
   replay protection.
3. Commerce maps the allowlisted ERP client to exact allowed capabilities.
4. Commerce adds immutable management audit records and idempotency receipts for mutations.
5. ERP adds reviewed routes/UI and adds Commerce permissions to the account catalog with an
   explicit administrator backfill decision.
6. Disabled-boundary, unauthorized, replay, stale-signature, invalid-payload, idempotency and
   authorized non-production smoke tests pass.
7. A separate activation approval is received.

## Current slice and non-goals

This slice adds only types, the disabled server transport, the Homepage Hero adapter, documentation
and tests in ERP. It adds no ERP route, Server Action or UI; performs no network request; changes no
Supabase schema or data; changes no Commerce repository; and enables no runtime flag.

Rollback is a code/document revert. There is no database rollback and no data-loss risk.
