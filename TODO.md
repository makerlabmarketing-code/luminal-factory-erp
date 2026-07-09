# Luminal Factory ERP TODO

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
