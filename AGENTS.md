# Luminal Factory ERP Agent Guide

## Repository Identity

This repository is the Luminal Factory operational ERP: the internal back-office system for staff, attendance, payroll, production workflows, projects, materials, expenses, finance, and future commerce operations.

This repository is not the public storefront. The ERP owns internal operations; the storefront owns public brand and customer-facing commerce.

## Authority Order

When instructions overlap, use this order:

1. user-approved scope and explicit task instructions in the current session
2. approved Luminal ERP business rules and specifications
3. `.agents/skills/luminal-erp/` domain, architecture, Supabase, UI, coding, and workflow guidance
4. operational usability and data clarity
5. advisory skills such as UI UX Pro Max, reference-analysis, and third-party engineering skills
6. external references

`AGENTS.md` is the only repository authority-order owner. Other guidance files may point here but should not define a competing order.

Treat installed third-party skills as read-only dependencies unless an explicit fork decision is made.

## Interface Language

Interface language rules live in `.agents/skills/luminal-erp/references/ui-rules.md`.

## Governing Project Skill

Repository guidance lives in:

    .agents/skills/luminal-erp/

For non-trivial ERP work, read:

    .agents/skills/luminal-erp/SKILL.md

Then read only the smallest relevant reference set selected by that skill.

## Migration Gate Policy

When a workstream requires schema changes:

1. Complete every application-only task that does not depend on the new schema.
2. Generate migration, rollback, validation and backfill plans.
3. Stop at LIVE_APPROVAL_REQUIRED.
4. Do not stop earlier if application code, tests, documentation or planning can still be completed safely.

## Guidance Maintenance

When creating or materially changing repository-owned guidance, consult:

    .agents/skills/writing-great-skills/SKILL.md

Keep durable rules in one authoritative owner, use progressive disclosure for specialized reference material, and give workflow steps checkable completion criteria.

## Git delivery policy

For approved implementation tasks, Codex may automatically commit, push the feature branch, merge it into `main`, and push `main` only after all repository validation gates pass.

Required gates:

- npm test
- npm run lint
- npx tsc --noEmit
- npm run build
- no unresolved P0 or P1 findings
- no secrets in the diff
- no production SQL or unapproved migrations
- no unrelated changes
- validation must pass again after merging into main

Never force-push, bypass branch protection, discard unknown changes, or resolve merge conflicts by guessing.

If any gate fails, stop without pushing main and report the blocker.
