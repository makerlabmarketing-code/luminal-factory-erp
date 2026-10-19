# Multiple people per project phase

User approval of behavior: 2026-10-19, selected “Nhiều người cùng làm” after
reporting that project membership could be added but phase assignment was absent.

- A phase has zero or more assigned employees, selected with checkboxes from the
  project's active, assignable members. Names are display values; persisted links
  use employee/phase foreign keys. No inferred name backfill.
- Project owners/managers or existing global project managers may change the set.
  Project contributors may read but cannot assign. This grants no new permission.
- Allow preparation for LOCKED phases without changing their status. Closed
  projects and completed/cancelled phases cannot be changed.
- Save the whole selected set atomically with its immutable before/after audit.
  An expected current set rejects lost updates; retries of the resulting set are
  no-ops. Empty selection removes assignments with history retained.
- Revoked/inactive project members remain visible in existing assignments, marked
  unavailable; removal is allowed, fresh assignment is rejected. Other edits that
  retain an unavailable person must remove that person before saving.
- Do not change individual task assignees, stage workflow states, employee access,
  notification delivery, payroll, or task rollout gates.
- Existing stage_owner free text stays legacy context and is not a new link.

Database/app rollout requires the separate explicit live approval described in
supabase/drafts/phase-members/README.md. No Production change is made by this PR.
