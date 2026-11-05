# Luminal Factory ERP TODO

## Staff permission incident · 2026-11-02

- [x] Reproduce Hà access inconsistency under authenticated PostgreSQL role.
- [x] Prepare positional-argument fix, rollback and 23 disposable PostgreSQL assertions.
- [x] Separate live helper repair approved and applied as `20261102065026`; PR #249 merged, no permission rows changed.
- [ ] After deployment, verify real staff/admin sessions.
- Package: [permission helper repair](supabase/drafts/permission-argument-shadowing/README.md).

## QA-003 · 2026-11-02

- [x] Reconcile the missing local checkpoint with current Production catalog.
- [x] Prepare guarded history grants/immutability package and executable local fixtures.
- [x] Exact SQL approval and Production migration `20261102061722_qa003_history_hardening`.
- [x] Read-only postflight confirms reviewed triggers, grants and RLS.
- [ ] Business acceptance and separately approved flag activation.
- [x] Add eight disposable PostgreSQL staff/stale-write acceptance cases and run the existing checklist/template runner in Vitest.
- Remaining live/UI acceptance: [04/11 checkpoint](docs/qa003-checklist-acceptance-20261104.md).
- Package and compatibility/cascade impact: [review note](supabase/drafts/qa003-history-hardening/README.md).

## Animate UI · 2026-11-01 · E-021

- Project checklist stages and assignment/deadline overrides use the local Animate UI v1 disclosure adaptation; adds pinned Motion 12.42.2.
- The current create-project dialog also uses Animate UI Fade (160ms); checklist disclosure visibility remains governed by existing workflow flags.
- Source, license and rollback: [integration note](docs/vendor/animate-ui.md).
- Validation and deployment evidence are tracked in the ERP & Commerce coordination sheet.
- This slice does not change workflow gates or activate any live capability.


## Current Phase

Architecture stabilization and production workflow refinement.

## Repository Foundation

- [ ] Review and finalize `AGENTS.md`
- [ ] Add Luminal ERP skill
- [ ] Install `writing-great-skills`
- [ ] Install UI UX Pro Max
- [ ] Reuse `reference-analysis`
- [ ] Audit repository-owned guidance
- [ ] Initialize GitHub Spec Kit
- [ ] Create ERP constitution

## Validation Foundation

- [ ] Inspect current package scripts
- [ ] Add or verify a working typecheck command
- [ ] Review the current lint command
- [ ] Establish reliable build validation
- [ ] Decide the first regression-test seam

## Supabase Foundation

- [ ] Audit all Supabase client implementations
- [ ] Standardize browser client
- [ ] Standardize server client
- [ ] Standardize middleware or auth client
- [ ] Standardize Supabase environment variable names
- [ ] Document current RLS assumptions
- [ ] Audit privileged operations

## Type System

- [ ] Inventory reusable interfaces
- [ ] Centralize shared domain types
- [ ] Remove duplicate domain interfaces
- [ ] Inventory existing `any`
- [ ] Remove `any` incrementally from touched modules
- [ ] Replace display-name relationship matching with stable IDs

## Attendance

- [ ] Audit AttendanceView responsibilities
- [ ] Extract attendance data operations
- [ ] Standardize attendance types
- [ ] Verify check-in and check-out rules
- [ ] Verify worked-hours calculation
- [ ] Verify timezone and day-boundary behavior
- [ ] Add regression coverage around attendance calculations

## Employees

- [ ] Audit employee queries and mappings
- [ ] Replace `full_name` relationship matching with employee IDs
- [ ] Extract employee service operations
- [ ] Standardize employee types

## Payroll

- [x] E-012: prepare the [payroll → ledger design and acceptance matrix](specs/payroll-ledger-link.md), including zero amount, adjustments, reopening, races and legacy reconciliation.
- [x] E-012: owner approved continuing the design; prepare the [draft SQL/application/test package](supabase/drafts/payroll-ledger-link/README.md), default OFF and no backfill.
- [x] E-012: exercise 21 disposable PostgreSQL transaction/lifecycle/role cases and server/rendered-row guards; retain old salary month confirmation for legacy rows.
- [x] E-012: owner-authorized tungduy baseline browser acceptance: zero settlement, reload, reopening with test reason, reload and retained history; final November period open, no payment confirmation.
- [x] E-012: five genuine overlapping two-connection races passed on PostgreSQL 17.11 in CI run 41957492424; 26 database cases total.
- [ ] E-012: matching Supabase test-environment/integrated-row browser acceptance before SQL approval or live activation; no non-Production Supabase branch currently exists.

- [ ] Audit payroll inputs and source records
- [ ] Keep payroll calculations outside visual components
- [ ] Standardize payroll types
- [ ] Review rounding behavior
- [ ] Add regression coverage around salary calculation
- [ ] Document payroll source-of-truth rules

## Production Workflow

- [ ] Audit `PRODUCTION_WORKFLOW` settings usage
- [ ] Map current workflow stages
- [ ] Define colorway-level tracking requirements
- [ ] Define granular workflow status vocabulary
- [ ] Define assignment rules
- [ ] Define blocked and review states
- [ ] Define approval and revision rules
- [ ] Define workflow history requirements
- [ ] Extract workflow service operations
- [ ] Standardize workflow types
- [ ] Refactor production views after workflow contract approval

## Finance and Expenses

- [ ] Audit expense source records
- [ ] Extract financial service operations
- [ ] Standardize financial types
- [ ] Verify aggregation and date-filter rules
- [ ] Keep derived totals tied to authoritative source records

## Staff Portal

- [ ] Audit attendance, task, expense, and profile views
- [ ] Identify unnecessary shared data loading
- [ ] Split large views by responsibility
- [ ] Reduce avoidable rerenders
- [ ] Preserve mobile usability
- [ ] Review Staff Portal with UI UX Pro Max

## Commerce Back Office

- [ ] Audit overlap with storefront requirements
- [ ] Define Product administration
- [ ] Define Product Variant or Colorway administration
- [ ] Define Raffle administration
- [ ] Define winner operations
- [ ] Define Commission operations
- [ ] Define Customer operations
- [ ] Define Order operations
- [ ] Define Payment and Refund operations
- [ ] Define Shipment operations
- [ ] Decide shared domain strategy after both repositories are audited

## Do Not Start Blindly

- repository-wide rewrite
- monorepo migration
- final shared commerce schema
- destructive database migration
- payment integration
- production raffle winner automation
