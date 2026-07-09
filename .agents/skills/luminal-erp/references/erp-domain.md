# ERP Domain

## Staff

A staff or employee record represents a person operating within Luminal Factory.

Use stable employee identifiers for persisted relationships.

Display names are presentation values, not authoritative relationship keys.

Relevant concerns may include active status, branch or work location, role, assigned work, attendance, and payroll.

## Attendance

Attendance records represent operational time evidence.

Relevant events include check-in and check-out.

Attendance logic may need to handle missing check-out, duplicate check-in, duplicate check-out, day boundaries, timezone behavior, location validation, and manual correction.

Worked hours should derive from authoritative timestamps and approved adjustment rules.

## Payroll

Payroll derives from approved payroll rules and authoritative operational inputs.

Potential inputs include attendance, worked hours, hourly rate, fixed salary rules, and approved adjustments.

Authoritative payroll totals should be calculated from approved source inputs outside transient UI state.

Preserve enough source data to reproduce totals.

## Production Project

A production project represents operational work toward a product, release, collection, or production objective.

A project may contain one or more colorways or variants.

Project-level status and colorway-level progress are separate concerns.

Production work should be traceable by project, colorway or variant, workflow stage, workflow status, assigned staff, timestamps, and review or approval when required.

## Colorway

A colorway is a visual or production variant.

Production tracking may need to be assigned and reviewed per colorway.

A colorway may share product identity while having separate color planning, tests, media, production progress, and approval state.

## Workflow Definition

A workflow definition describes operational stages.

Current workflow configuration may be loaded from system settings associated with `PRODUCTION_WORKFLOW`.

Workflow definitions may evolve.

Historical project records must remain interpretable after workflow changes.

## Workflow Stage

A workflow stage is a named operational step.

Examples from Luminal production may include:

- concept
- sculpt
- 2D or card preparation
- color planning
- support and slicing
- test print
- parameter tuning
- mold making
- resin casting
- sanding
- painting
- packaging
- photography
- video
- content
- shipping
- after-sales

The final list is configurable and product-dependent.

## Workflow Status

A workflow status describes the state of work inside a stage.

A workflow status is a domain state, not only a display label.

The current product needs more detail than the three-state shorthand of not started, in progress, and completed.

Candidate conceptual states include:

- NOT_STARTED
- READY
- ASSIGNED
- IN_PROGRESS
- BLOCKED
- WAITING_REVIEW
- NEEDS_REVISION
- APPROVED
- COMPLETED
- SKIPPED
- CANCELLED

The final state machine must be approved against real staff operations before schema changes.

## Assignment

Workflow tasks may be assigned to staff members using stable identifiers.

Assignment history may matter for accountability and production traceability.

## Approval and Review

A completed action and an approved result are not always the same state.

Preserve this distinction where the actual production process needs it.

## Materials and Inventory

Operational inventory may distinguish raw materials, consumables, and finished product stock.

Examples include printing resin, casting resin, silicone, packaging materials, and finishing consumables.

The ERP should preserve source quantities and inventory movements when authoritative stock is required.

## Expenses

Expenses are source records.

An expense may include category, amount, date, description, employee or submitter, project relation, and approval state.

Derived totals should come from source records.

## Finance

Financial reporting should derive from authoritative operational and commerce source records.

Financial totals should derive from expenses, payments, refunds, and other authoritative source records rather than independent copies that can drift.

## Future Commerce Administration

The ERP is expected to become the operational back office for:

- products
- product variants
- product media
- collections
- raffles
- raffle lifecycle
- winner operations
- commissions
- customers
- orders
- payments
- refunds
- shipments
- finished product inventory

Shared commerce contracts must remain compatible with the storefront.
