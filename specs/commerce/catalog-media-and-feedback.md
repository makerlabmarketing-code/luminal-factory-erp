# Catalog media and feedback — 2026-10-05

Approved user scope: multiple photos per Product/Colorway, cover/order/alt, recoverable
removal and corner success/error toasts on data loads and create/edit/remove actions.
Keep manual English entry. No AI. Existing translations are retained under optional
"Bản dịch bổ sung"; no EN/VI data is removed or republished.

ERP reuses NotificationProvider/useNotification through useCommerceFeedback. Product
refresh success waits for fresh server props; Colorway/translation reads notify only
after target-bound validation, suppress aborted requests. Saves show success only
after validating server-confirmed records. Validation and network errors retain input
and remain inline as well as in a root portal toast. Hero manual reload now notifies.
The global stack retains four latest toasts at the existing z-index 999999, preserving
workspace isolation, dismiss controls and persistent errors. This slice does not
intercept fetch globally or alter unrelated ERP screens' existing notifications.

MediaManagerClient keeps a bounded sequential file queue, optimizes JPEG/PNG/WebP,
shows per-file upload/retry state, uses immutable signed tickets, validates confirmed
metadata, retains revisions, protects unsaved changes and supports mouse ordering
plus keyboard-friendly Lên/Xuống. Gỡ ảnh is confirmed and recoverable with Khôi phục;
Lưu bộ ảnh acknowledges the persisted manifest. Object URLs are revoked on cleanup.

Management uses existing COMMERCE_PRODUCT_VIEW/MANAGE checks and signed server
transport; ERP never queries Commerce's database or receives its privileged key.
Application routes are GET/POST/PATCH /products/:id[/colorways/:variantId]/media and
POST .../media/upload-ticket. Reads include short-lived private previews; write results
exclude tokens/URLs. No object deletion or public publication operation exists.

Storage/SQL ownership and complete forward/validation/rollback/preflight package:
https://github.com/makerlabmarketing-code/luminal-factory-commerce/blob/feat/catalog-media-gallery-20261005/specs/commerce/catalog-media-drafts.md

COMMERCE_CATALOG_MEDIA_ENABLED is server-only and defaults false. Keep it off until
the exact Commerce SQL package is approved and validated. Earlier E-005/E-006 SQL
approval does not cover this new storage/manifest package. No ERP SQL is required.

Validation: npm test, npm run lint, npx tsc --noEmit, npm run build; pure payload/target
validation, upload ticket binding, denied-before-transport route tests and UI access
render tests. Actual private upload end-to-end remains pending SQL approval.

Rollback: disable the media flag or revert this PR via protected main. Existing text
drafts, public product data, ERP permissions and NotificationProvider API remain.
