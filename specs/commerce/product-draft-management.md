# ERP Product draft management

## Boundary and acceptance

The resumed Product/Colorway roadmap starts with Product draft administration
through Commerce's existing management contract. ERP remains the staff UI;
Commerce remains authoritative. This slice extends the existing Product list,
without introducing an ERP copy of catalog data.

- View requires `ADMIN_WORKSPACE` and `COMMERCE_PRODUCT_VIEW`.
- Create/edit require `COMMERCE_PRODUCT_MANAGE` on both ERP route entry and
  the signed server transport, mapping to `commerce.product.write`.
- `POST /api/admin/commerce/products` maps to Commerce
  `POST /api/admin/v1/products`; `PATCH .../{id}` maps to Commerce PATCH.
- The existing Commerce RPC updates only rows whose status is `draft`.
  Published and archived rows have no editor action.
- Fields: name, slug, description, product type, release type. Validation
  matches the existing Commerce draft schema, rejects unexpected fields,
  and requires artisan keycaps to use `informational` releases via raffle.
- Identical retries retain the same operation ID until confirmed success.
  Writes are never automatically retried; the user explicitly retries.
- Failed saves retain form input. Confirmed saves reconcile the returned
  Commerce record. Unsaved edits prompt before switching/cancelling and
  prevent accidental document unload.
- Vietnamese search, status filters, loading action, empty/error/disabled
  states and horizontal table scrolling support desktop and smaller screens.
- When integration is off, authorized managers can compose locally; save is
  disabled. Local composition does not persist across document reloads.

## Validation and delivery

Run full Vitest, lint, TypeScript and production build. Behavioral tests cover
input bounds, keycap policy, denied-before-parse route access, operation ID
forwarding, separate write capability, no automatic write retry, malformed
success records and rendered view-only/manager/empty/error/disabled states.
Authenticated end-to-end create/edit remains a separate live smoke gate;
unit/rendered tests do not establish real persistence or production PASS.

## Data and rollout impact

No dependency, migration, RPC, RLS, permission catalog, credential, runtime flag,
public product content, price or stock changes are included. Non-owner manage
permission provisioning and Commerce credential scope provisioning are separate
reviewed gates. The existing targeted Product view grant PR is independent.
Protected PR review and production approval precede deployment.

Colorway administration follows this Product slice. Commerce currently has no
Colorway management endpoint in the inspected API. Its contract, stable Product
relationship, allowed fields and write authorization require a separate slice;
do not overload Product description or ERP production colorways to bridge it.

Rollback: revert the application slice. No database rollback or data loss
applies to the code revert. Any records subsequently created through authorized
live use remain Commerce records and are not deleted by reverting ERP code.
