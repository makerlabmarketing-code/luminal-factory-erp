# GitHub Review Remediation Handoff

## Deferred review sources

The fast functional roadmap run intentionally did not inspect, classify, resolve, or act on:

- GitHub pull request comments or conversations;
- Codex Code Review findings;
- Copilot review comments;
- CodeQL suggestions;
- historical remediation notes or previously closed review findings.

This deferral prevents review stabilization work from interrupting capability-gated functional completion. It does not classify any unseen finding as fixed, non-actionable, or accepted.

## Start condition

Begin the remediation pass only after the functional roadmap changes and their required migration/RPC packages are on the intended pull request branch. Use the current pull request and current branch as the delivery target; do not create a duplicate pull request for the same slice.

Before remediation, record:

- branch name and head commit;
- pull request number and base commit;
- functional validation results;
- live capabilities that are active versus still gated;
- migrations/RPCs awaiting protected-main delivery or post-rollout validation.

## Remediation workflow

1. Read the current Code Review workflow findings and unresolved pull request conversations.
2. Read current Copilot and CodeQL findings relevant to the branch diff.
3. Compare each newly available finding with the repository remediation ledger only at this stage.
4. Inspect the referenced code and its actual server/UI execution path; never apply a suggestion blindly.
5. Classify each finding as `ACTIONABLE`, `ALREADY_FIXED`, `NOT_APPLICABLE`, `FALSE_POSITIVE`, or `BUSINESS_DECISION_REQUIRED`.
6. Fix each `ACTIONABLE` finding with the smallest safe change and focused regression coverage.
7. Explain `NOT_APPLICABLE` and `FALSE_POSITIVE` findings with technical evidence.
8. Stop rather than guessing on `BUSINESS_DECISION_REQUIRED`.
9. Run affected checks after each remediation group, then run the full repository validation gates.
10. Update the existing pull request and re-check for newly generated findings.
11. Resolve conversations only after the fix is validated, the implementation is proven correct, or an approved decision rejects the suggestion.

## Guardrails

- Preserve approved ERP business rules, stable identifiers, workspace/project membership separation, attendance shift calculation, and server-derived actors.
- Do not activate a client feature solely because migration SQL exists in the repository.
- Do not bypass capability checks, RLS, server authorization, or protected-main migration delivery.
- Do not mutate production data, execute production SQL, grant live permissions, deploy, merge, or expose secrets during review remediation.
- Treat review findings against compatibility mode in the context of the actual production capability state.
- Reopen completed roadmap foundations only when a current finding demonstrates a reproducible regression.

## Required validation

Run and record:

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Also confirm that the final diff contains no secrets, direct production SQL execution, fake persistence, browser-direct privileged Supabase mutation, or unrelated cleanup.

## Exit criteria

- Every available current finding has a recorded classification and evidence.
- Every `ACTIONABLE` finding is fixed with regression coverage.
- No unresolved P0/P1 or `BUSINESS_DECISION_REQUIRED` item is hidden.
- All required validation gates pass.
- The existing pull request is updated and newly generated findings have been re-checked.
- Production capability and approval blockers remain explicit in the pull request handoff.
