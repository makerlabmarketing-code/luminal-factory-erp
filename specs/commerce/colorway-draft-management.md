# ERP Colorway draft management (E-005)

Canonical domain/SQL contract: Commerce `specs/commerce/colorway-draft-management.md`.
Commerce owns `product_variants`, linked through stable Product UUIDs; ERP does
not copy catalog data or use operational Colorways for public catalog metadata.

## ERP slice

Product administration now includes an integrated Colorway list/create/edit panel.
Only name, slug and description are writable. Existing Product view/manage
permissions and signed Commerce product read/write scopes apply at both route
and transport boundaries. Parent IDs come from validated route parameters.
Draft parents and inactive variants are enforced by the planned Commerce RPC.
Failed input and operation IDs survive explicit retries; stale reads abort and
unsaved edits require confirmation before switching or leaving. No automatic
retry, publication, reparenting, price, stock, media or permission writes.

## Validation and delivery gate

ERP full Vitest: 119 files / 883 tests passed; post-review focused rerun: 12
tests passed. Full lint, TypeScript and production build passed. The prior
runtime blockage was resolved on 03 October 2026. Commerce full check passed
(lint, TypeScript, 346 tests, static security, zero-vulnerability production
dependency audit, production build). No real production UI/persistence smoke
ran; the owner will test when available.

Forward/validation/rollback SQL passed isolated single-connection WASM
PostgreSQL via PGlite 0.5.8 testing against repository Product/Variant/receipt definitions.
Tests cover create/edit, exact replay, fingerprint mismatch, duplicate slug,
wrong parent, published/active mutation rejection, metadata retention, actual
service-role invocation/public-role denial, fixture rollback and retained data
after function/index rollback. Two-session concurrency remains a hosted/native
PostgreSQL verification gate. Read-only Commerce production preflight confirms
zero duplicate slug groups, absent new RPC, variant RLS enabled and no public
INSERT/authenticated UPDATE grants. No live SQL writes were performed.

Do not deliver ERP ahead of the Commerce endpoint/RPC. Exact SQL preflight,
nonproduction transaction/concurrency tests and production review remain gates.
Once all checks and reviews pass, owner-authorized PR merge and deployment can
proceed without another application approval. Rollback removes application UI
and routes; retained Commerce drafts/receipts must not be deleted.
