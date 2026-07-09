# Development Workflow

## Core Workflow

Use a small-step operational workflow:

1. inspect
2. model current behavior
3. identify the seam
4. specify the intended change
5. implement the smallest safe slice
6. validate
7. review the diff
8. continue to the next slice

## Audit Before Refactor

For a non-trivial existing module:

1. locate the page or view
2. identify imported services and clients
3. identify Supabase queries
4. identify local calculations
5. identify repeated interfaces
6. identify side effects
7. identify callers and dependent views

Completion criterion:

The current behavior and responsibility map are explicit enough that the intended seam can be named and every touched dependency is known.

## Preferred Current Refactoring Sequence

`references/project-context.md` owns the current preferred refactoring sequence.

Use that sequence unless an active bug or business priority requires a different safe slice.

## Specification Rule

Use a formal specification when changing:

- production workflow states
- attendance semantics
- payroll rules
- inventory semantics
- finance source-of-truth rules
- shared ERP and storefront commerce contracts
- major Staff Portal workflows

A small internal refactor with unchanged behavior may use a focused task plan instead.

## Bug Diagnosis

For hard bugs, use a disciplined diagnosis loop:

1. reproduce
2. minimize
3. form a hypothesis
4. instrument
5. fix
6. add regression coverage when a stable test seam exists

## Testing Direction

Prefer tests around pure operational logic first.

High-value seams include worked-hours calculation, salary calculation, workflow-transition validation, and financial aggregation.

Do not wait for a perfect test architecture before protecting critical calculation rules.

## Validation

Inspect:

    npm run

Use available scripts.

The repository may not define `typecheck`, `check`, or `test`.

Do not assume they exist.

When supported by the current TypeScript configuration, `npx tsc --noEmit` may be appropriate.

For production-code changes, validate the narrow operational workflow manually in addition to static checks.

High-value domain checks:

- attendance: check-in, check-out, duplicate actions, date boundaries, missing records, and worked hours
- payroll: attendance inputs, salary inputs, missing employee mappings, and rounding
- workflow: assignment, transitions, blocked states, review, revision, approval, history, filters, and colorway visibility
- finance: source records, aggregation, categories, and date filtering

Claim validation only when it has actually run successfully.

## Completion Report

Report:

1. current behavior understood
2. seam changed
3. important files changed
4. behavior preserved or intentionally changed
5. validation performed
6. known limitations or remaining debt
7. unresolved domain or architecture decisions
8. next safe slice

Report the actual completed seam; a module is only refactored when every relevant responsibility has moved to its intended owner and no duplicate legacy path remains without an explicit compatibility reason.
