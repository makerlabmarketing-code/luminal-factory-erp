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


## Work Priority Policy

Codex must select work using this priority order:

1. P0 production blockers
2. P1 newly actionable Code Review findings
3. P2 next approved roadmap feature
4. P3 explicitly reported bugs
5. P4 UI or copy polish
6. P5 documentation-only improvements

Rules:

- Work only on the highest-priority available item.
- Do not start lower-priority polish while higher-priority feature or bug work remains.
- Completed UX, translation, typography, spacing, and copy polish must not be revisited unless:
  - a new user-reported bug requires it;
  - an actionable Code Review finding requires it;
  - the roadmap explicitly reopens it;
  - a regression test proves the completed behavior is broken.
- Cosmetic wording changes alone must not become a roadmap slice.
- Documentation-only work must not displace approved application work.
- Do not invent cleanup work merely because no connected review source is available.
- REVIEW_SOURCE_UNAVAILABLE is not permission to create speculative polish work.
- Do not reopen completed slices without new evidence.
- When multiple items have the same priority, prefer:
  1. production correctness;
  2. data integrity;
  3. authorization and security;
  4. core business workflow;
  5. user-facing usability;
  6. cosmetics.

## Roadmap Continuation

When no P0, P1, or explicit reported bug blocks progress:

- continue the next approved roadmap feature;
- do not create standalone wording, spacing, or documentation slices;
- stop only at LIVE_APPROVAL_REQUIRED, a real validation failure, a Git delivery blocker, or an explicit business decision.

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


## Autonomous Roadmap Execution

Future roadmap sessions should advance through the roadmap without requiring additional orchestration prompts.

When continuing a previous roadmap session, automatically determine:

- latest completed slice
- latest merged state
- latest roadmap position
- latest remediation status

Continue from that point and never restart previous slices unless new evidence creates an unresolved blocker.

Continue roadmap slices automatically. Do not stop after every slice. Stop only when reaching:

- `LIVE_APPROVAL_REQUIRED` and no safe preparatory work remains
- destructive migration
- production deployment
- schema mutation requiring approval
- explicit user instruction
- unresolved blocker

Otherwise continue to the next roadmap task.

Expected autonomous execution loop:

```
Implement
      ↓
Test
      ↓
Review
      ↓
Remediate
      ↓
Update Docs
      ↓
Prepare Migration Package (if needed)
      ↓
LIVE_APPROVAL (if needed)
      ↓
Continue Next Slice
```

When `LIVE_APPROVAL_REQUIRED` is reached, continue every safe task before stopping, including:

- documentation
- tests
- application wiring
- review remediation
- roadmap update
- handoff
- validation SQL
- rollback SQL
- compatibility analysis

Stop only when no safe work remains before the approval gate.

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

Then prepare the complete migration package before requesting live approval:

- forward migration
- rollback
- validation SQL
- compatibility report
- backfill plan
- RLS plan
- handoff
- roadmap update

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

For approved implementation work, Codex may, after every repository validation gate passes:

- commit
- push the current feature branch through approved GitHub tooling
- create or update the pull request
- enable auto-merge only when the available GitHub integration supports it and no actionable Code Review findings remain

Successful branch push and pull request creation count as completed delivery only after the Code Review Source and Remediation Policy below is satisfied.

`AUTO_MERGE_UNAVAILABLE` is a delivery limitation, not an implementation blocker.

Codex must never push or merge directly to `main`; protected branch rules own the merge.

Required gates:

- npm test
- npm run lint
- npx tsc --noEmit
- npm run build

### Test Command Policy

This repository uses Vitest. The full test command is:

```
npm test
```

Targeted tests must use repository-supported Vitest syntax, such as passing a test file path or Vitest-supported filter through npm. Jest-only flags such as `--runInBand` must not be used. Unsupported test-runner flags are tooling-command failures, not implementation failures.

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

Stop only when branch push, pull request creation, validation, conflict, approval, or branch protection fails.

If any stop condition occurs:

- stop
- report the blocker
- do not push


## Supabase Database Connectivity and GitHub Migration Delivery

Codex Cloud must not require direct PostgreSQL TCP connectivity for repository progress.

When the Supabase Session Pooler host, port, username, project reference, and IPv4 resolution have been confirmed but outbound PostgreSQL TCP attempts fail with `Network is unreachable`, record `DATABASE_TCP_UNAVAILABLE`. This is an execution-environment limitation, not a Supabase credential failure, IPv6 configuration failure, repository defect, or malformed Session Pooler URL.

If Codex Cloud cannot reach PostgreSQL because database TCP is unavailable, the network is unreachable, IPv6 resolution fails, a firewall blocks access, or the cloud sandbox restricts outbound database connections:

- do not repeatedly retry `psql`, `supabase db push`, `supabase db query`, or pooler probes from Codex Cloud;
- prepare the migration package;
- prepare the validation package;
- prepare the rollback package;
- update the roadmap;
- update the handoff;
- update remediation records;
- stop before deployment or live mutation;
- never classify this as a repository failure;
- never expose access tokens, database passwords, connection strings, or `.pgpass` contents;
- keep `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as setup-only secrets, not ordinary environment variables.

When the Supabase GitHub Integration is configured, treat it as the canonical production migration delivery workflow. Place only approved forward migrations under `supabase/migrations/`, keep rollback and validation artifacts separately, create or update the pull request, and let the protected main-branch merge workflow trigger Supabase production migration delivery. Never attempt production migration directly from Codex Cloud when database connectivity is unavailable. Do not place draft or unapproved SQL under `supabase/migrations/`. Production database changes still require every approval gate.

---
## Supabase Management API Fallback

If the Supabase Management API returns Cloudflare Error 1010 (`browser_signature_banned`), HTTP 403 from `api.supabase.com` with that confirmed infrastructure restriction, or another confirmed infrastructure restriction unrelated to repository correctness:

1. Record `MANAGEMENT_API_UNAVAILABLE`.
2. Do not treat this as a repository failure.
3. Skip only:
   - project metadata verification through the Management API
   - Management API health verification
4. Continue using the reviewed repository artifacts:
   - migration package
   - rollback package
   - validation SQL
   - compatibility/backfill plan
   - application contract
   - reviewed RPC contract
5. Continue application-only implementation normally.
6. Live SQL/RPC deployment still requires explicit `LIVE_APPROVAL_REQUIRED`.
7. Never silently ignore validation failures unrelated to the Management API.
8. Clearly document the skipped verification inside the roadmap, handoff, and remediation ledger.

Do not weaken any production safety gate because Management API verification is unavailable.

### Pull Request and Auto-Merge

After all required validation gates pass, Codex should:

1. Commit the completed work.
2. Push the current feature branch through approved GitHub tooling.
3. Create or update the pull request.
4. Process review findings according to the Code Review Source and Remediation Policy below.
5. Enable auto-merge when the available GitHub integration supports it and no actionable Code Review findings remain.
6. Allow GitHub to merge only after all required checks, reviews, and branch protection rules pass.
7. Never merge or push directly to `main`.

If auto-merge is unavailable in the current integration:

- report `AUTO_MERGE_UNAVAILABLE`
- provide the created PR metadata or PR link when available
- do not treat this alone as an implementation failure
- consider the delivery step complete when the branch and PR have been created successfully

Stop and report only when:

- the branch cannot be pushed
- the pull request cannot be created
- a merge conflict exists
- a required check fails
- required approval is missing
- branch protection blocks delivery
- unexpected target-branch changes create risk

After the pull request is merged, future roadmap work must continue from the latest `main` branch.

## Code Review Remediation Policy

Before starting any new roadmap slice:

1. Inspect only newly opened review comments, newly actionable findings, and unresolved findings for the current open PR.
2. Compare new findings against docs/CODE_REVIEW_REMEDIATION.md.
3. Do not re-review completed slices.
4. Skip findings already classified as:
   - ALREADY_FIXED_AND_VERIFIED
   - FALSE_POSITIVE_WITH_EVIDENCE
   - NOT_APPLICABLE_WITH_EVIDENCE
5. Keep previously fixed findings closed unless new evidence appears.
6. Remediate ACTIONABLE findings before implementing unrelated roadmap work.
7. Update CODE_REVIEW_REMEDIATION.md after every remediation PR.

### Code Review Source and Remediation Policy

For every implementation pull request, review findings must be processed before delivery is considered complete.

Review source priority:

1. Current Codex GitHub Code Review findings shown in the Code Review workflow.
2. Unresolved conversations on the current pull request.
3. Review findings explicitly supplied by the user.
4. Repository tests, static analysis, and self-review findings.

When findings are available, Codex must:

1. Inspect every finding.
2. Classify it as:
   - ACTIONABLE
   - ALREADY_FIXED
   - NOT_APPLICABLE
   - FALSE_POSITIVE
   - BUSINESS_DECISION_REQUIRED
3. Fix every ACTIONABLE finding using the smallest safe change.
4. Add or update focused regression tests.
5. Preserve approved business rules, permissions, schema, RLS, and workflow rules.
6. Explain FALSE_POSITIVE and NOT_APPLICABLE findings technically instead of changing correct code.
7. Stop on BUSINESS_DECISION_REQUIRED instead of guessing.
8. Rerun all affected validation gates after fixes.
9. Update the existing pull request for the same roadmap slice.
10. Re-check Code Review after each update because new findings may appear.

Delivery is complete only when:

- no unresolved ACTIONABLE findings remain
- no unresolved P0 or P1 findings remain
- all required validation gates pass
- the current pull request has been updated successfully

If the active task cannot access Code Review findings:

- record `REVIEW_SOURCE_UNAVAILABLE`
- continue implementation and roadmap execution with available review sources
- do not guess missing findings
- do not block unrelated work solely because old merged-PR findings are unavailable
- instruct the operator to run remediation from the Code Review workflow or provide the findings explicitly when review remediation itself is the active task

Auto-merge must not proceed while actionable Code Review findings remain.

### Pull Request Review Comment Policy

Unresolved pull request conversations are one review source under the Code Review Source and Remediation Policy.

For each unresolved pull request review comment or conversation, Codex must:

1. Inspect the referenced code and surrounding execution path.
2. Classify and remediate the finding according to the Code Review Source and Remediation Policy.
3. Do not blindly apply reviewer suggestions.
4. Resolve a review conversation only after:
   - the issue is fixed and validated
   - the existing implementation is proven correct
   - or an approved decision explicitly rejects the suggestion

### Existing Pull Request Update Policy

When an implementation pull request for the current roadmap slice is still open:

1. Treat that pull request and its feature branch as the active delivery target.
2. Inspect all newly generated Code Review findings and unresolved review comments.
3. Classify each finding according to the Code Review Source and Remediation Policy.
4. Fix every ACTIONABLE finding using the smallest safe change.
5. Add or update focused regression tests.
6. Commit the fixes to the same feature branch.
7. Update the existing pull request.
8. Do not create a second pull request for the same roadmap slice.
9. Re-check Code Review and pull request conversations after each update because new findings may appear.
10. Continue this review-fix-update loop until:
    - no unresolved ACTIONABLE findings remain
    - no unresolved P0 or P1 findings remain
    - all required validation gates pass

Do not treat the pull request as delivery-complete while actionable Code Review findings remain.

A new pull request may be created only when:

- the previous pull request has already been merged or closed
- the new work is a separate roadmap slice
- the original branch can no longer be safely updated
- or an explicit delivery decision requires a separate pull request

If the existing pull request cannot be updated because the branch, remote, GitHub integration, or permission is unavailable:

- report `EXISTING_PR_UPDATE_BLOCKED`
- preserve the completed commit
- do not silently create a duplicate pull request
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

## Automated delivery workflow

For every implementation task:

1. Work only on the Codex task branch created for the task.
2. Do not run `git push` through the sandbox shell.
3. Do not add, remove, or modify Git remotes.
4. Never push directly to `main`.
5. Complete the requested implementation before delivery.
6. Run all relevant tests, lint, type-check, build, and `git diff --check`.
7. Fix all failures introduced by the implementation.
8. Commit all verified changes.
9. Follow the Pull Request and Auto-Merge policy above.
10. Reuse the existing pull request when continuing the same task.
11. Do not merge when tests fail, required secrets are unavailable, or the change contains an unresolved business-rule decision.
12. Report the pull request status, test results, and remaining blockers.

A missing shell Git remote such as `origin` is not an implementation failure.
Do not attempt to repair it using `git remote add`.

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
