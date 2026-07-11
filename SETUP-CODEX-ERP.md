# Codex and Skills Setup for Luminal Factory ERP

## 1. Purpose

This file is the setup plan, phase plan, and prompt launcher for controlled Luminal Factory ERP refactoring.

It is not the authority-order owner and should not hold durable ERP business rules. Authority order lives in `AGENTS.md`.

Durable guidance owners:

- project context and priorities: `.agents/skills/luminal-erp/references/project-context.md`
- architecture boundaries: `.agents/skills/luminal-erp/references/architecture.md`
- ERP business rules and workflow statuses: `.agents/skills/luminal-erp/references/erp-domain.md`
- Supabase, database, and migration preflight: `.agents/skills/luminal-erp/references/supabase-contract.md`
- UI, Vietnamese vocabulary, app shell, page patterns, and design references: `.agents/skills/luminal-erp/references/ui-rules.md`
- TypeScript, React, service, error, and calculation style: `.agents/skills/luminal-erp/references/coding-style.md`
- phase gates, validation, rollback, and reporting: `.agents/skills/luminal-erp/references/workflow.md`

Interface language requirements are phase goals here; detailed rules live in `.agents/skills/luminal-erp/references/ui-rules.md`.

This is an existing operational application. Use controlled refactoring, not a rewrite.

## 2. Package Manager and External References

The repository currently uses npm when `package-lock.json` is present.

Do not create `pnpm-lock.yaml` or `yarn.lock` unless the user explicitly approves a package-manager migration.

Do not run the following without explicit approval:

- `npm audit fix --force`
- destructive database commands
- production migrations
- dependency upgrades unrelated to the active phase
- broad formatting across unrelated files
- automatic removal of existing components
- replacement of business logic with mock services

External references are advisory under `AGENTS.md`.

Recommended references and skills:

- GitHub Spec Kit: constitution, specification, implementation plan, tasks, implementation workflow, and traceability
- `writing-great-skills`: guidance maintenance
- UI UX Pro Max: UI/UX review only where compatible with this Next.js web ERP
- `reference-analysis`: ERP reference analysis under repository-owned authority

Do not install unrelated UI kits, website-cloning templates, marketing-site-only skills, duplicate Shadcn skills, or overlapping code-review skills without a defined purpose.

## 3. Setup Order

1. Copy this ERP guidance bundle into the ERP repository.
2. Install or verify `writing-great-skills`.
3. Verify `.codex/skills/reference-analysis/SKILL.md` and its provenance.
4. Install or verify UI UX Pro Max as advisory design intelligence.
5. Audit repository-owned guidance.
6. Refine `AGENTS.md` and `.agents/skills/luminal-erp/`.
7. Review the guidance diff.
8. Commit the ERP guidance foundation if approved.
9. Initialize Spec Kit only after the guidance foundation is reviewed and committed.
10. Create the ERP constitution.
11. Audit the real ERP codebase.
12. Create the first refactor specification.
13. Execute implementation in approved phases.

Do not initialize multiple planning systems that duplicate each other without defining ownership.

## 4. Phase Plan

Phase gates, validation, rollback, next-phase approval, and reporting rules live in `.agents/skills/luminal-erp/references/workflow.md`.

### Phase 0A: Guidance Foundation

Scope:

- review repository-owned guidance
- review installed skill ownership
- review authority order
- identify stale or duplicate instructions
- move durable rules to their reference owners
- keep `AGENTS.md` short
- keep `luminal-erp/SKILL.md` as a router
- keep Vietnamese interface language and vocabulary rules in their owners

Completion criteria:

- repository guidance map produced or updated
- ownership conflicts resolved or listed
- durable rules live in their reference owners
- Vietnamese interface vocabulary has a clear source-of-truth owner
- no application code modified
- no dependency installed
- no migration executed
- diff reviewed before commit

### Phase 0B: Repository Audit

Scope:

- inspect package manager and dependency state
- inspect current application structure
- inspect docs and specs
- inspect Supabase usage and schema
- inspect current business-rule implementation
- inspect current UI architecture

Completion criteria:

- architecture summary produced
- current module and data-flow maps produced
- Supabase usage map produced
- business-rule ownership map produced
- duplicated logic and high-risk calculations listed
- permission, accessibility, performance, and test gaps listed
- no application code modified
- no dependency installed
- no migration executed

### Phase 1: Supabase and Shared Foundations

Scope:

- standardize Supabase client usage
- standardize Supabase environment variable naming
- centralize shared types
- identify duplicated query logic
- establish service boundaries
- establish shared error handling

Completion criteria:

- one documented Supabase client strategy
- environment names are consistent or compatibility is documented
- duplicate shared types are removed or deprecated
- validation follows the matrix in `workflow.md`

### Phase 2: Staff, Attendance, and Payroll Protection

Scope:

- replace employee relationship matching by `full_name`
- use stable identifiers
- extract attendance service seams
- extract employee service seams
- protect attendance calculations
- protect payroll calculations
- add regression tests for critical calculations where a stable seam exists

Completion criteria:

- no critical relationship depends on `full_name`
- attendance calculations have protection
- payroll calculations have protection
- service ownership is documented
- existing user flows remain functional
- validation follows the matrix in `workflow.md`

### Phase 3: Production Workflow Domain

Scope:

- formalize project workflow
- define colorway-level tracking
- define assignment, review, revision, approval, blocking, reopening, history, and permission behavior
- define Vietnamese status labels through `erp-domain.md`
- define database change plan

Completion criteria:

- approved domain model
- approved state-transition map using `erp-domain.md` canonical statuses
- approved Vietnamese label map for every user-visible status
- approved database change plan
- no migration before approval
- transition tests designed
- audit requirements defined

### Phase 4: Workflow and Financial Services

Scope:

- extract workflow services
- extract financial services
- move business logic out of views
- decompose large views
- centralize validation
- centralize permission checks
- establish audit-log seams

Completion criteria:

- UI components no longer own core calculations
- workflow transitions are validated centrally
- financial calculations have defined ownership
- large views are decomposed within approved scope
- validation follows the matrix in `workflow.md`

### Phase 5: SaaS Application Shell and Design System

Scope:

- inspect Shadcn readiness
- inspect Efferd Dashboard 2 compatibility
- define design tokens
- implement shared app shell
- implement sidebar, header, breadcrumbs, and permission-aware navigation
- implement shared page patterns and data states
- establish one shared Vietnamese vocabulary source for labels and messages

Completion criteria:

- one shared application shell
- no duplicate global layout
- navigation respects permissions
- light theme works
- dark theme works if approved
- desktop and tablet layouts pass review
- no demo data remains
- all user-visible shell and shared-pattern labels are Vietnamese and sourced from the shared vocabulary where reusable
- validation follows the matrix in `workflow.md`

### Phase 6: Dashboard and Project UI

Scope:

- redesign Dashboard
- redesign Project List
- redesign Project Detail
- implement Workflow View
- implement Task Kanban
- implement Timeline
- implement My Work

Completion criteria:

- dashboard uses real data
- project pages use shared patterns
- Kanban validates transitions
- workflow statuses are readable
- workflow statuses use canonical Vietnamese labels
- overdue and blocked states are visible
- responsive behavior is verified
- critical UI flows have protection where practical

### Phase 7: Production and Operations UI

Scope:

- Production
- Print Tests
- Mold Management
- Casting Batches
- Quality Control
- Inventory
- Assets

Completion criteria:

- modules use the shared app shell
- no parallel design system
- tables, filters, forms, and status patterns are consistent
- labels, empty states, validation, and status badges use the shared Vietnamese vocabulary
- permission handling is consistent
- validation follows the matrix in `workflow.md`

### Phase 8: Commerce, Team, and Finance UI

Scope:

- Products
- Colorways
- Raffles
- Orders
- Fulfillment
- Customers
- Staff
- Attendance
- Payroll
- Expenses
- Revenue
- Budget
- Reports

Completion criteria:

- modules use shared patterns
- calculations remain protected
- no fake dashboard metrics
- repeated statuses use the same Vietnamese labels across modules
- access permissions are enforced
- regression tests pass where available

### Phase 9: Performance, Accessibility, and Release Readiness

Scope:

- optimize Staff Portal data loading
- reduce unnecessary rerenders
- inspect large queries
- inspect duplicate requests
- accessibility review
- responsive review
- production build verification
- remove unused demo components after confirming no usage
- remove obsolete UI after confirming no usage

Completion criteria:

- validation follows the matrix in `workflow.md`
- no critical accessibility issue remains
- no unused Efferd demo data remains
- rollback notes are documented

## 5. Guidance Audit Prompt

Use this before editing guidance files:

Review the repository-owned Luminal ERP skill and agent guidance system using the installed `writing-great-skills` guidance.

Scope:

- `AGENTS.md`
- `.agents/skills/luminal-erp/SKILL.md`
- `.agents/skills/luminal-erp/references/*`
- `.codex/skills/reference-analysis/SKILL.md`
- `SETUP-CODEX-ERP.md`

Treat installed third-party skills as read-only references.

Do not change application code. Do not edit files until the audit report is produced. Preserve approved ERP business rules and known refactoring priorities.

Review for duplication, weak invocation triggers, no-op guidance, stale sediment, sprawl, misplaced reference material, missing progressive disclosure, missing completion criteria, overlapping ownership, unclear authority, package-manager conflicts, missing phase gates, missing rollback requirements, missing testing requirements, and guidance that encourages broad unreviewed changes.

Produce:

- findings with severity
- file-by-file change plan
- source-of-truth ownership map
- recommended edit order
- authority conflict map
- proposed phase gates
- missing completion criteria
- risks if guidance remains unchanged

Do not implement changes until approved.

## 6. Full Repository Audit Prompt

Use this only after the repository guidance audit is approved.

Read:

- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `SETUP-CODEX-ERP.md`
- `.agents/skills/luminal-erp/SKILL.md`
- `.agents/skills/luminal-erp/references/*`
- `.codex/skills/reference-analysis/SKILL.md`
- `docs/*`
- `specs/*`
- repository configuration files
- application source code
- Supabase schema and migrations

Begin Phase 0B: Repository Audit.

Audit the repository for architecture, project structure, Supabase client usage, environment variable naming, duplicated types, employee relationships, attendance calculations, payroll calculations, project workflow, colorway tracking, production workflow, assignments, approvals, permissions, audit logging, application shell, layout, sidebar, header, dashboard, tables, forms, responsive behavior, accessibility, performance, loading states, empty states, error states, duplicated components, hard-coded styles, hard-coded statuses, hard-coded permissions, and business logic inside UI components.

Do not modify code. Do not install dependencies. Do not run migrations. Do not run `npm audit fix`. Do not install Efferd Dashboard 2. Do not move to another phase.

Produce:

1. architecture summary
2. current module map
3. current data-flow map
4. current project workflow
5. current UI architecture
6. current Supabase usage map
7. business-rule ownership map
8. duplicated logic list
9. high-risk calculation list
10. permission gaps
11. accessibility gaps
12. performance risks
13. file-by-file proposed change plan
14. database impact forecast
15. dependency impact forecast
16. test gaps
17. phased implementation plan
18. rollback concerns
19. recommended first specification

## 7. Phase Reporting Format

After every implementation phase, report:

1. work completed
2. files added
3. files modified
4. files removed
5. database impact
6. API impact
7. dependency impact
8. business-rule impact
9. migration impact
10. permission impact
11. risks remaining
12. tests added
13. tests executed
14. lint result
15. type-check result
16. production-build result
17. manual verification performed
18. rollback notes
19. proposed next phase

Next-phase approval rules live in `.agents/skills/luminal-erp/references/workflow.md`.

## 8. Starting Instruction

Start with the guidance audit only.

Read the repository-owned guidance files. Do not modify application code. Do not install dependencies. Do not run migrations. Do not run Efferd Dashboard 2. Do not run `npm audit fix`.

Produce the guidance audit report and wait for approval.
