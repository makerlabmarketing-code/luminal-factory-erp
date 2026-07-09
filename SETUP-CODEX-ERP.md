# Codex and Skills Setup for Luminal Factory ERP

## Recommended External Repositories

### GitHub Spec Kit

Repository:

    github/spec-kit

Role:

- constitution
- specification
- plan
- tasks
- implementation workflow

### Matt Pocock Skills

Repository:

    mattpocock/skills

Install first:

    writing-great-skills

Recommended later for ERP engineering:

- diagnosing-bugs
- tdd
- domain-modeling
- codebase-design
- code-review

Do not install every skill blindly.

### UI UX Pro Max

Repository:

    nextlevelbuilder/ui-ux-pro-max-skill

Role:

- ERP UI and UX review
- tables
- forms
- responsive behavior
- accessibility
- information hierarchy
- dashboard anti-pattern review

### Reference Analysis

Reuse the repository-owned `reference-analysis` skill from the commerce repository.

Role:

- analyze ERP references
- analyze workflow systems
- analyze dashboard patterns
- translate reference behavior into Luminal ERP requirements

## Not Required

Do not reinstall the old website-cloning template or pixel-perfect clone skill.

The ERP is an existing operational application.

## Suggested Install Order

1. copy this ERP guidance bundle into the ERP repository
2. install `writing-great-skills`
3. copy `reference-analysis` from the commerce repository
4. install UI UX Pro Max for Codex
5. audit repository-owned guidance
6. commit the ERP guidance foundation
7. initialize Spec Kit
8. create the ERP constitution
9. audit the real ERP codebase
10. create the first refactor specification

## First ERP Refactor Program

Phase 1:

- standardize Supabase client usage
- standardize Supabase environment variable naming
- centralize shared types

Phase 2:

- replace employee relationship matching by `full_name`
- extract attendance and employee service seams
- protect attendance and payroll calculations

Phase 3:

- formalize the production workflow domain
- define colorway-level tracking
- define granular workflow statuses
- define assignment, review, revision, and approval behavior

Phase 4:

- extract workflow and financial services
- decompose large views
- optimize Staff Portal data loading and rerenders

## Codex Review Prompt

Review the repository-owned Luminal ERP skill and agent guidance system using the installed writing-great-skills guidance.

Scope only:

- AGENTS.md
- .agents/skills/luminal-erp/SKILL.md
- .agents/skills/luminal-erp/references/*
- .codex/skills/reference-analysis/SKILL.md

Treat installed third-party skills as read-only references.

Do not change application code.
Do not edit any file yet.

Preserve approved ERP business rules and known refactoring priorities.

Review for:

1. duplication
2. weak invocation triggers
3. no-op guidance
4. stale sediment
5. sprawl
6. misplaced reference material
7. missing progressive disclosure
8. steps without checkable completion criteria
9. overlapping ownership
10. unclear authority ordering

Produce:

- findings with severity
- file-by-file change plan
- source-of-truth ownership map
- recommended edit order

Do not implement changes.
