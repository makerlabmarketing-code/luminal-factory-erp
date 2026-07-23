# Development Workflow

This file owns working process, phase gates, validation, rollback reporting, and guidance-maintenance workflow.

## Core Workflow

Use a small-step operational workflow:

1. inspect
2. model current behavior
3. identify the seam
4. specify the intended change
5. implement the smallest safe slice
6. validate
7. review the diff
8. report the result

Completion criterion:

The slice has one named boundary, the intended behavior is explicit, relevant validation has run or been reported unavailable, and the diff has been reviewed before any commit.

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
- user-facing status labels or shared vocabulary
- attendance semantics
- payroll rules
- inventory semantics
- finance source-of-truth rules
- shared ERP and storefront commerce contracts
- major Staff Portal workflows

A small internal refactor with unchanged behavior may use a focused task plan instead.

Completion criterion:

The specification names the affected business rule owner, user-visible behavior, data impact, validation plan, rollback path, and approval gate before implementation starts.

## Phase Gates

Continue automatically from one safe phase or slice to the next when no approval gate, business decision, security approval, production deployment, real infrastructure blocker, or validation failure is present. Stop at `LIVE_APPROVAL_REQUIRED` only after every safe application, package, test, documentation, roadmap, handoff, and PR-preparation step for the active slice is complete.

### Guidance Foundation

Scope: repository-owned guidance only.

Completion criteria:

- authority order has one owner
- durable rules are in their reference owners
- Vietnamese interface vocabulary rules are in the UI and domain owners
- duplication and conflicts are identified or resolved
- no application code is modified
- no dependency is installed
- no migration is run
- diff is reviewed before commit

### Repository Audit

Scope: codebase, configuration, docs, specs, Supabase schema, and migrations.

Completion criteria:

- architecture, data flow, Supabase usage, business rules, UI architecture, permission gaps, test gaps, and risks are mapped
- no production code is modified
- no dependency is installed
- no migration is run
- recommended first specification is reported

### Specification

Scope: requirements and design for a bounded change.

Completion criteria:

- scope, non-goals, business rules, data impact, permission impact, validation, rollout, and rollback are explicit
- user-facing copy, status labels, and vocabulary impact are explicit when UI is affected
- unresolved questions are listed
- user approval is received before implementation

### Implementation

Scope: one approved phase or one approved safe slice.

Completion criteria:

- newly available actionable Code Review findings have been inspected before starting the slice
- implementation stays within approved scope
- business-rule impact is reported
- Vietnamese label and shared-vocabulary impact is reported when UI is affected
- database, API, dependency, permission, and migration impact are reported
- migration packages, rollback notes, validation artifacts, documentation, and handoff updates are produced inside the same feature slice whenever possible instead of split into standalone preparation tasks
- relevant validation runs or is reported unavailable
- rollback notes are documented
- diff is reviewed before commit

### Migration

Scope: database schema, data migration, RLS, generated types, or production data operations.

Completion criteria:

- current schema and proposed schema are documented
- new tables, changed columns, foreign keys, indexes, unique constraints, and policies are listed
- forward SQL, rollback SQL, validation SQL, compatibility/backfill artifacts, documentation, and tests are complete before PR delivery
- reviewed forward SQL for the Supabase GitHub Integration path is committed under `supabase/migrations/` only after approval for PR-based delivery; rollback and validation artifacts stay outside that directory
- after commit and PR creation/update, stop at the production approval boundary and let protected-main merge plus Supabase GitHub Integration perform production execution
- do not create a separate "Apply migration" task for a complete reviewed package
- direct production migration is not run from Codex Cloud

### Release Readiness

Scope: final validation, accessibility, performance, and rollback readiness for a deliverable phase.

Completion criteria:

- lint, type-check, tests, and production build run when available
- manual checks for affected workflows are reported
- user-visible UI text is checked for Vietnamese-only copy, shared label usage, and consistent status names
- critical accessibility or permission risks are resolved or explicitly accepted
- rollback notes are documented

## Validation Matrix

Inspect available scripts before choosing commands:

    npm run

Use npm while `package-lock.json` is present unless the user approves a package-manager migration.

Do not assume `typecheck`, `check`, or `test` scripts exist. When supported by the current TypeScript configuration, `npx tsc --noEmit` may be appropriate.

Validation by change type:

- guidance-only: review rendered markdown intent, owner placement, duplication removal, internal consistency with AGENTS.md and relevant skill references, and diff; no build is required
- TypeScript or React code: run lint/type-check/build when available and manually verify the affected workflow when practical
- pure calculations: add or run focused tests for worked hours, salary, workflow transitions, or financial aggregation when a stable seam exists
- Supabase clients or queries: verify environment names, auth boundary, RLS or trusted server boundary, typed result shape, and relevant data states
- database or migration plan: do not run production migration; report schema diff, backfill, compatibility, rollback, and data-loss risks first
- UI work: verify responsive behavior, keyboard access, focus states, status clarity beyond color, loading, empty, filtered-empty, error, and permission-denied states
- UI copy or labels: verify all user-visible text is Vietnamese, reusable labels come from the shared vocabulary source, statuses use mappings from `references/erp-domain.md`, and no screen mixes English and Vietnamese except allowed names, codes, technical IDs, or user-entered data

Claim validation only when it has actually run successfully. If validation is unavailable, report the missing script, blocker, or reason.

## Domain Checks

High-value checks:

- attendance: check-in, check-out, duplicate actions, date boundaries, missing records, and worked hours
- payroll: attendance inputs, salary inputs, missing employee mappings, and rounding
- workflow: assignment, transitions, blocked states, review, revision, approval, history, filters, and colorway visibility
- finance: source records, aggregation, categories, and date filtering

## Rollback Rules

Every implementation report should include rollback notes.

Rollback notes should identify:

- files or modules touched
- database or migration rollback path when applicable
- feature flag or compatibility path when applicable
- data-loss risk
- user-facing behavior to verify after rollback

For guidance-only work, rollback can be the document diff that restores the previous owner placement.

## Diff Review Before Commit

Before creating a commit, review the diff for:

- unrelated file changes
- accidental application-code changes
- package manager or lockfile drift
- migrations or generated files
- durable rules placed in the wrong owner
- broad formatting churn
- validation claims that did not run
- duplicated hard-coded Vietnamese labels in components
- missing status-to-label mappings for user-visible enums

Completion criterion:

The reviewed diff contains only approved-scope changes, and any unrelated existing worktree changes are left untouched.

## Bug Diagnosis

For hard bugs, use a disciplined diagnosis loop:

1. reproduce
2. minimize
3. form a hypothesis
4. instrument
5. fix
6. add regression coverage when a stable test seam exists

## Completion Report

Report:

1. current behavior or guidance owner understood
2. seam changed
3. important files changed
4. behavior preserved or intentionally changed
5. validation performed
6. known limitations or remaining debt
7. unresolved domain or architecture decisions
8. rollback notes
9. next safe slice, if one is being proposed

Report the actual completed seam. A module is only refactored when every relevant responsibility has moved to its intended owner and no duplicate legacy path remains without an explicit compatibility reason.
