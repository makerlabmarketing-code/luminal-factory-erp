---
name: luminal-erp
description: Use for non-trivial Luminal Factory ERP work: operational data correctness, staff/attendance/payroll, production workflow, materials, finance, Supabase or auth boundaries, ERP UI, brownfield architecture, or repository guidance changes.
---

# Luminal Factory ERP Skill

Use this skill for non-trivial work in the Luminal Factory ERP repository.

Luminal ERP is an operational back-office system. Preserve working behavior while improving one explicit seam at a time.

## Reference Map

Read the smallest relevant set of references required for the active branch. When a task spans branches, read each branch owner before editing.

### Project context

Read `references/project-context.md` when the task touches repository purpose, storefront boundaries, current technical concerns, operational priorities, or the preferred refactoring sequence.

### Architecture

Read `references/architecture.md` when moving code, changing page/view responsibilities, extracting services, changing feature boundaries, or adjusting Server/Client Component boundaries.

### ERP domain

Read `references/erp-domain.md` when changing staff, attendance, payroll, production projects, colorways, workflow definitions, workflow statuses, workflow status labels, assignment, approval, materials, expenses, finance, or future commerce administration.

### Supabase

Read `references/supabase-contract.md` when changing Supabase clients, environment variables, RLS, authorization, query boundaries, database types, workflow settings storage, migrations, or shared backend strategy.

### UI

Read `references/ui-rules.md` when changing ERP admin UI, Staff Portal UI, application shell, page patterns, dashboards, production state presentation, tables, forms, responsive behavior, accessibility, Vietnamese interface copy, shared label sources, or when applying UI UX Pro Max recommendations.

### Coding

Read `references/coding-style.md` when changing TypeScript, React, naming, types, service functions, Supabase query wrappers, error handling, calculations, or refactoring mechanics.

### Workflow

Read `references/workflow.md` when planning or implementing a change, auditing before refactor, deciding whether a formal specification is needed, validating, reporting completion, reviewing a diff before commit, or maintaining guidance files.

For guidance maintenance, also consult `.agents/skills/writing-great-skills/SKILL.md`.

## Core Working Rule

Before editing:

1. inspect the current implementation or guidance owner
2. identify the authoritative data source, rule, or reference owner
3. trace callers, dependent views, or dependent guidance
4. choose the smallest safe change boundary
5. validate with the available checks for that boundary

Completion criterion:

Every changed behavior or durable rule is traced to its owner, all touched dependents are accounted for, the relevant validation has run when applicable, and the diff has been reviewed before any commit.
