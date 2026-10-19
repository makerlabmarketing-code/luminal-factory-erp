# Project workspace and add-action repair — 2026-10-19

User requested a complete layout change and reported that adding phases and
members did not work. Scope is the project detail workspace and these actions.

## Verified defects and response

1. The Add phase button had no click handler despite an existing authorized POST
   endpoint. It now opens a name-only form, appends the next phase order, prevents
   duplicate in-flight clicks, displays server errors inline, refreshes phases
   and selects the returned phase. Cancellation and phase permissions still gate
   the action; authorization stays server-side.
2. The phase service sent null for omitted progress/requiredReview, whereas live
   columns are NOT NULL with defaults 0/false. Apply those defaults in the service
   while preserving explicit template values. No migration or contract expansion.
3. The supplied member screenshot has a two-character reason; both client and
   server require 10–500 characters. Preserve the audit rule. Offer a visible,
   editable routine reason on opening, display a character count/validation help,
   and show server errors inside the form. Clear stale candidates after a success.
   No employee is added until the user selects one and submits.

## Layout

Replace the long stacked page with three keyboard-accessible tabs: Work, Members,
and Project information. The Work tab pairs a phase rail with the selected phase
and tasks. On smaller screens the phase rail becomes a horizontal strip. Member
management, audit and revoked history live in Members. Drive, workload, activity
and cancellation live in Project information. A compact progress/deadline strip
replaces repeated summary tiles. New/add-member dialogs portal to body, contain
keyboard focus, close with Escape when idle, restore focus and retain typed values
on failure. Notifications remain above dialogs.

The task foundation/atomic-create runtime gates are unchanged. They are a separate
rollout gap; this patch does not pretend that disabled task creation is enabled.
No test member/phase or other Production data is created for UI verification.

## Validation and rollback

974 tests across 137 files pass, including five runtime tests covering minimal
phase input, explicit template values, invalid input, denied access and DB failure.
Lint, production build and TypeScript pass; browser verification is recorded in
the shared roadmap after deployment. Mobile/populated task flows are separate
coverage unless explicitly recorded. Revert the workspace/dialog/tab/service diff
to restore the former page; no schema, grant, flag or persisted-data rollback.
