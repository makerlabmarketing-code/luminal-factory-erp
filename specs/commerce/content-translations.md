# E-006 ERP translation editor

The shared coordination Sheet row E-006 authorizes preparation; Production SQL,
new runtime activation and public publication remain gated.

Canonical cross-application contract and SQL package are owned by Commerce:
[Catalog translations](https://github.com/makerlabmarketing-code/luminal-factory-commerce/blob/feat/content-translations-20261003/specs/i18n/catalog-translations.md).

ERP view/manage permissions and signed server transport remain unchanged.
Product editor selects a stable Product UUID and EN/VI locale; base name/slug,
commercial facts and existing public content are never edited by this panel.
Incomplete drafts are allowed; readiness requires title/description and does not
publish. Interface labels remain Vietnamese; entered content uses chosen locale.

Exact revision/target/content response validation confirms persistence. Failed
input and operation IDs survive explicit retries. Aborted stale reads cannot
replace another selection; save remains disabled until that target's read is
confirmed. Unsaved changes warn before changing Product/language/reloading and
protect browser unload. Local offline composition is clearly not persistent.

The editor now offers Product content or an existing Colorway selected from a
parent-bound, validated list. Product/Colorway/language reads use distinct keys;
switching aborts older reads and requires unsaved-change confirmation. The shared
panel supports draft translations for active variants too: source/public content
is unaffected. A failed Colorway list leaves Product translation available.
E-005 application code is merged into this feature branch; Production delivery
still requires the separately approved E-005 SQL and Commerce rollout first.
No permission grants, database credentials or browser Commerce transport.

Required tests/lint/type-check/build and diff review precede draft PR delivery.
Build-only Supabase public placeholders may be supplied when local build lacks
configuration; this is not live-auth/E2E validation and changes no deployed env.
After reviewed SQL and Commerce deployment, controlled editor create/reload/edit
smoke must pass before ERP rollout. Full native concurrency/hosted preflight are
separate from the isolated PGlite fixture. Rollback restores the app commit and
revokes feature access while preserving translation data/receipts.

## Validation evidence (2026-10-03)

- ERP: 119 files / 888 tests, lint, TypeScript and production build PASS. Local
  build used explicitly fake public Supabase settings; no auth/live E2E claim.
- Commerce: 353 tests, lint (two existing warnings), TypeScript, static security,
  production audit 0 vulnerabilities and production build PASS.
- PGlite 0.5.8: real invoker create/read/replay/stale/conflict/readiness, parent FK,
  public RLS/column grants, source preservation and data-preserving rollback PASS.
- Built runtime with local mock catalog: EN/VI/EN Product/listing/title/story/SEO,
  shared slug/price and translation-service failure fallback PASS.
- Hosted preflight, native two-session concurrency and authenticated owner editor
  smoke remain unperformed. No Production SQL/runtime/secrets/data changed.

## Continuation — 2026-10-05

Colorway selector and editor wiring are prepared with focused parent/entity/locale
and signed-route regression coverage. Production read-only preflight verifies
two draft Products, one published Product, one Variant; translation tables/RPC
are absent and public variant writes remain denied. PostgreSQL 17 concurrency
and rollback now have a disposable CI job in Commerce; await its result before
claiming that gate passes. Exact Production SQL approval and authenticated
create/reload/edit remain required. No migration, live write or public publish.
