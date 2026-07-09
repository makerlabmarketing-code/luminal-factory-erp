# Architecture

## Principle

Refactor the existing ERP incrementally.

Refactor around current behavior and coupling observed in the active task.

## Responsibility Boundaries

### Pages

Pages should focus on route parameters, page-level access, page-level data composition, and view composition.

Large operational workflows should not live directly in page files.

### Views

Views own screen composition, feature presentation, and interactive orchestration.

Attendance calculations, salary calculations, workflow transition rules, financial aggregation, and inventory enforcement should live in domain or service seams that views call.

### Services

Services expose meaningful operational operations.

Examples:

    getAttendanceForEmployee
    checkInEmployee
    checkOutEmployee
    calculateWorkedHours
    getEmployees
    updateEmployee
    getProductionWorkflow
    assignWorkflowTask
    transitionWorkflowStatus
    calculatePayroll
    getExpenseSummary

A service should hide data-access or operational complexity behind a small interface.

A service should provide a meaningful operational operation, not only a renamed Supabase query.

### Types

Reusable domain types should live in stable type modules.

Avoid repeated interfaces representing the same domain object differently without an intentional reason.

## Supabase Boundary

`references/supabase-contract.md` owns Supabase client strategy, environment variables, RLS, authorization, query boundaries, and shared backend strategy.

Supabase access should not be copied into every component.

Feature-specific query functions or services should provide typed interfaces.

## Feature Direction

The application may evolve toward feature boundaries such as:

    attendance
    employees
    payroll
    production
    workflow
    materials
    finance
    staff-portal
    commerce-admin

Use these boundaries when a current task exposes a real coupling problem; the list is not a mandatory folder plan.

## Server and Client Components

Use Server Components where supported by the current Next.js 13 architecture and data flow.

Use Client Components for hooks, browser APIs, local interaction, timers, realtime browser subscriptions, geolocation, QR interaction, and client-rendered charts.

Before making a large parent component client-side, consider extracting the smallest interactive child.

## Existing-Application Rule

Before moving code:

1. identify callers
2. identify imported types
3. identify Supabase dependencies
4. identify user-visible behavior
5. identify side effects
6. identify validation coverage

Completion criterion:

The moved responsibility has one clear owner, all callers use the intended boundary, and no duplicate legacy path remains without an explicit compatibility reason.

## Shared Commerce Architecture

ERP and storefront may eventually share commerce domain types, database contracts, and validation schemas.

Possible future strategies:

1. shared package
2. monorepo package
3. generated database types plus shared validation contracts

Choose a permanent repository-sharing strategy after auditing both repositories and the Supabase schema.
