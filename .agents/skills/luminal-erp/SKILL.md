---
name: luminal-erp
description: Use for non-trivial Luminal Factory ERP work: operational data correctness, staff/attendance/payroll, production workflow, materials, finance, Supabase or auth boundaries, ERP UI, brownfield architecture, or repository guidance changes.
---

# Luminal Factory ERP Skill

Use this skill for non-trivial work in the Luminal Factory ERP repository.

Luminal ERP is an operational back-office system. Preserve working behavior while improving one explicit seam at a time.

## Route the task

Start from [AGENTS.md](../../../AGENTS.md) and load each matching reference below. For roadmap continuation, read the active item and verify its current delivery and acceptance status before choosing work.

| Task | Reference |
| --- | --- |
| Project scope, ERP versus Commerce, refactoring order | [Project context](references/project-context.md) |
| Architecture or ownership boundaries | [Architecture](references/architecture.md) |
| ERP behavior, roles, domain states, workflow and payroll | [ERP domain](references/erp-domain.md) |
| Supabase, migrations, authentication and authorization | [Supabase contract](references/supabase-contract.md) |
| Forms, tables, accessibility, UI copy and layout | [UI rules](references/ui-rules.md) |
| TypeScript, React and service conventions | [Coding style](references/coding-style.md) |
| Roadmap, QA, release evidence and guidance updates | [Development workflow](references/workflow.md) |
| Direct browser QA | [Browser QA](../../../docs/qa/erp-browser-qa.md) |
| Editing repository guidance or skills | [Writing guidance](../writing-great-skills/SKILL.md) |

Trace the user entry point through the affected owners and validation. Verify the requested outcome, record outstanding acceptance with a specific next action, and review the diff before committing.
