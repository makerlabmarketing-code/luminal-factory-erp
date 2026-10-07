# Product workspace — 07/10/2026

Owner request: list-only catalog and an individual product page for information,
media, translations and colorways. Published/archived information must remain
maintainable without republishing or changing lifecycle state.

## Application scope

- `/admin/commerce/products`: search, status filter, list, create/detail links.
- `/admin/commerce/products/new`: manage-authorized create; after confirmed save,
  replace the URL with the actual product detail route.
- `/admin/commerce/products/{id}`: view-authorized detail. Serialize only the
  selected product; existing bounded 200-product reader remains authoritative.
  Missing/out-of-bound IDs, failed reads and integration-off are distinct states.
- Media, translation and colorway managers receive a fixed product ID, omit
  redundant selectors and keep existing API, permission and draft rules.
- Return/cancel checks all child dirty/busy states. Document unload retains the
  existing dirty protection. There are no new dependencies or ERP tables.

## Information update gate

Commerce's existing `manage_catalog_product` update action is draft-only on the
live database (read-only definition checked 07/10). The prepared Commerce
`supabase/drafts/product-information-update/` package broadens information updates
to published/archived products while preserving status/published_at and forbidding
slug/product-type/release-type changes outside draft. Name and description are
editable; legacy non-draft release metadata is preserved without permitting new
direct-sale keycaps; prices, inventory, media publishing, colorway activation and re-publish
remain separate contracts. Existing service-role-only invocation, signed management
transport, receipts and retry fingerprint rules are retained.

ERP `COMMERCE_PRODUCT_INFORMATION_UPDATE_ENABLED` stays default-off until that
exact RPC change receives production approval. Disposable embedded PostgreSQL
validation has passed for all three states, protected fields, receipts, public
execution denial, fixture rollback and function rollback.
This flag controls presentation only; Commerce remains the trusted write boundary.
Archive information saves do not publish. Published information saves affect the
public product immediately, while optional translation drafts retain their own
existing publication semantics.

## Validation / delivery

SSR coverage checks list/detail isolation, fixed-target selectors, create and
permission boundaries, error states and the pending information-write gate.
Run full Vitest, lint, TypeScript, build and diff checks. Native authenticated
navigation and live persistence remain separately reported evidence.

No live SQL or runtime flag change is authorized by this application slice.
The SQL draft includes preflight, transactional forward, rollback and fixture
validation. No schema/table/column/index/RLS/backfill or catalog-row change occurs
when installing the replacement function. Isolated embedded PostgreSQL validation ran via PGlite 0.5.8; no production SQL
was executed.

Rollback: turn off the information flag, restore the original Commerce function
with the prepared rollback, and revert ERP application changes. Information saved
after activation is retained; code rollback does not delete catalog data.
