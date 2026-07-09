# Contributing to Luminal Factory ERP

## Direction

Luminal Factory ERP is an internal operational system.

Prioritize correctness, traceability, staff usability, and maintainable domain boundaries.

Read `AGENTS.md` and the relevant `luminal-erp` references before non-trivial changes.

## Understand Before Editing

Trace the current implementation, callers, Supabase queries, types, calculations, workflow settings, and side effects.

Do not rewrite a module based only on its filename or visual appearance.

## Preserve Domain Meaning

Use stable identifiers for relationships.

Do not use display names as durable relational keys when employee IDs exist.

Preserve history when workflow definitions evolve.

## Incremental Refactoring

Prefer focused changes.

Examples:

    refactor: standardize Supabase client usage
    refactor: extract attendance service
    fix: map attendance records by employee id
    feat: add blocked production workflow state
    perf: reduce Staff Portal rerenders

Avoid unrelated repository-wide cleanup during focused work.

## TypeScript

Use strict TypeScript.

Do not introduce new `any`.

Replace existing `any` when the touched code provides enough information to type safely.

## Supabase

Keep Supabase access behind documented client and service boundaries.

Never expose privileged credentials to browser code.

## Validation

Inspect available scripts with:

    npm run

Run all relevant checks available in the repository.

Do not claim validation passed unless it actually ran successfully.

## Documentation

Update durable guidance when changing architecture boundaries, domain terminology, production workflow semantics, Supabase strategy, attendance rules, payroll rules, or finance source-of-truth rules.

## AI-Assisted Contributions

Repository-owned skills define Luminal-specific rules.

Third-party skills are advisory dependencies.

External references must be adapted to Luminal's real operating model.
