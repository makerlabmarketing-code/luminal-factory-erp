# Project Context

## Project

Luminal Factory ERP

## Role

The ERP is the internal operational back office for Luminal Factory.

The business currently focuses on artisan keycaps and may later expand into collectible objects, keycap holders, art lamps, and other small 3D-produced products.

The ERP should reflect a small creative production studio, not a generic corporate ERP.

## Current Operational Areas

Known areas include:

- Admin
- Staff Portal
- attendance
- tasks
- expenses
- profile
- employees
- payroll
- production projects
- workflow settings
- materials or inventory concerns
- financial reporting concerns
- raffle administration
- commission administration
- product and collection administration
- order and fulfillment operations

Staff Portal conceptually contains:

- attendance
- task
- expense
- profile

## Operational Priorities

Prioritize:

1. data correctness
2. attendance integrity
3. payroll correctness
4. production traceability
5. material and inventory integrity
6. financial traceability
7. staff usability
8. visual refinement

## Current Technical Context

The application uses Next.js App Router, TypeScript, Supabase, and Tailwind CSS.

Known concerns from prior review include:

- large page and view components
- repeated Supabase queries
- duplicate Supabase client patterns
- inconsistent environment variable names
- repeated inline interfaces
- historical `any` usage
- business logic mixed with view logic
- employee mapping by `full_name` in some paths
- workflow configuration based on system settings and `PRODUCTION_WORKFLOW`

## Current Refactoring Direction

Preferred incremental order:

1. standardize Supabase access
2. centralize reusable types
3. replace unstable relationship matching
4. extract clear service seams
5. refine workflow contracts
6. reduce `any`
7. split oversized views
8. optimize Staff Portal data loading and rerenders

Potential service seams include attendance, employee, workflow, payroll, and financial services.

These are directional seams, not mandatory filenames.

## Production Reality

Luminal production is colorway-oriented.

Projects may need progress tracking per colorway or product variant.

Production may include:

- idea and concept
- sculpting
- 2D card or media preparation
- color planning
- support and slicing
- test printing and parameter tuning
- resin casting
- mold making
- sanding and finishing
- painting
- packaging
- photography and video
- content
- shipping and after-sales

Not every stage applies to every product.

The workflow system should support controlled variation without losing traceability.

Canonical workflow status vocabulary and transition rules live in `references/erp-domain.md`.

## Storefront Boundary

The ERP is the back office.

The public storefront is a separate customer-facing application.

Storefront-owned concerns include public brand experience, public product presentation, raffle discovery and customer entry, customer account, checkout, and customer commission submission.

Both may eventually share Supabase and compatible commerce contracts.

The final repository-sharing strategy remains open until a combined audit is complete.
