# Luminal Factory ERP Agent Guide

## Repository Identity

This repository is the Luminal Factory operational ERP: the internal back-office system for staff, attendance, payroll, production workflows, projects, materials, expenses, finance, inventory, and future commerce operations.

This repository is **not** the public storefront.

The ERP owns internal operations.

The storefront owns public brand and customer-facing commerce.

---

## Authority Order

When instructions overlap, always resolve them in this order:

1. User-approved scope and explicit task instructions in the current session.
2. Approved Luminal ERP business rules and specifications.
3. `.agents/skills/luminal-erp/`
4. Operational usability and data clarity.
5. Advisory skills
   - UI UX Pro Max
   - Reference Analysis
   - Third-party engineering skills
6. External references.

`AGENTS.md` is the only repository authority-order owner.

Other guidance files may reference this file but must never redefine authority order.

Treat installed third-party skills as read-only dependencies unless explicitly forked.

---

## Interface Language

Interface language rules live in:

```
.agents/skills/luminal-erp/references/ui-rules.md
```

---

## Governing ERP Skill

Repository implementation guidance lives in:

```
.agents/skills/luminal-erp/
```

For every **non-trivial ERP task**:

1. Read

```
.agents/skills/luminal-erp/SKILL.md
```

2. Follow its task router.

3. Read **only the smallest relevant reference set**.

Never load every reference document unless explicitly requested.

---

## Task Routing

The ERP skill is responsible for selecting the smallest relevant reference set.

Typical routing:

| Task | Read |
|------|------|
| Attendance | attendance references |
| Payroll | payroll references |
| Membership | membership references |
| Task Assignment | task assignment references |
| Project Workflow | workflow references |
| Finance | finance references |
| Inventory | inventory references |
| UI | ui-rules.md |
| Supabase/Auth/RLS | supabase-contract.md |
| Validation / Reporting | workflow.md |
| Repository Planning | SETUP-CODEX-ERP.md |

---

## Planning Guidance

`SETUP-CODEX-ERP.md` is the repository planning document.

Read it whenever the task involves:

- repository audit
- roadmap review
- implementation phase
- implementation completion
- architecture planning
- repository-wide refactoring
- selecting the next phase
- implementation report
- implementation handoff

Do **not** read the entire setup document for ordinary bug fixes unless required.

---

## Guidance Maintenance

Whenever creating or changing repository-owned guidance, consult:

```
.agents/skills/writing-great-skills/SKILL.md
```

Prefer:

- one authoritative owner
- progressive disclosure
- checkable workflow completion
- minimal duplicated guidance

---

## Progressive Disclosure

Never read the entire repository documentation by default.

Only load:

- required skills
- required references
- required specifications
- required roadmap sections

Avoid unnecessary context expansion.

---

## Roadmap Execution

The implementation roadmap is the execution authority for project progression.

When a roadmap exists:

- determine the current workstream
- determine the active phase
- determine acceptance criteria
- determine exit criteria

Continue automatically whenever allowed.

Update roadmap status after every completed phase.

---

## Auto Roadmap Execution

Unless blocked by an approval gate, continue the roadmap automatically.

Normal workflow:

```
Current Phase
      ↓
Implementation
      ↓
Internal Review
      ↓
Regression Review
      ↓
Validation
      ↓
Documentation Update
      ↓
Roadmap Update
      ↓
Commit
      ↓
Next Phase
```

Do not stop after every small implementation.

Only stop at approval gates.

---

## Phase Ownership

Each roadmap phase should contain:

- Objective
- Scope
- Acceptance Criteria
- Exit Criteria
- Handoff
- Known Risks
- Dependencies

When Exit Criteria PASS, automatically continue to the next phase.

---

## Migration Gate Policy

When a roadmap phase requires schema changes:

Complete every application-only task first.

Allowed before migration:

- services
- DTO
- validation
- API contract
- repository layer
- UI
- hooks
- tests
- documentation
- feature flags
- adapters
- roadmap updates
- handoff documents

Then prepare:

- migration
- rollback
- validation SQL
- backfill plan
- RLS plan

Then stop at:

```
LIVE_APPROVAL_REQUIRED
```

Do **not** stop earlier simply because migration will eventually be required.

---

## Approval Gates

Stop execution only when reaching an approval gate.

Examples:

- production SQL
- migration
- backfill
- RLS mutation
- live data mutation
- production deployment
- destructive operations

or when validation fails:

- P0
- P1
- build failure
- typecheck failure
- failing tests
- merge conflict
- git delivery failure

---

## Git Delivery Policy

For approved implementation work, Codex may:

- commit
- push feature branch
- merge into `main`
- push `main`

Only after every repository validation gate passes.

Required gates:

- npm test
- npm run lint
- npx tsc --noEmit
- npm run build
- no unresolved P0 or P1 findings
- no secrets in the diff
- no production SQL
- no unapproved migrations
- no unrelated changes
- validation passes again after merge

Never:

- force push
- bypass branch protection
- discard unknown changes
- guess merge conflict resolution

If any validation gate fails:

- stop
- report the blocker
- do not push

---

## Working Principles

Always trace implementation end-to-end:

```
UI
 ↓
API
 ↓
Service
 ↓
Repository
 ↓
Supabase
 ↓
DTO
 ↓
Tests
 ↓
Documentation
```

Never implement from assumptions.

Never change approved business rules unless explicitly requested.

Preserve existing working behaviour.

Improve one seam at a time.

Minimize regression risk.

## Working Mode

Default working mode is:

- Read AGENTS.md.
- Load the ERP skill.
- Load only the minimum required references.
- Read SETUP-CODEX-ERP.md when the task belongs to an implementation phase or roadmap.
- Continue the active roadmap automatically.
- Stop only at approval gates.
- Update roadmap, documentation and handoff after every completed phase.
- Run repository validation before considering a phase complete.
- Prefer completing the current workstream before starting unrelated work.
