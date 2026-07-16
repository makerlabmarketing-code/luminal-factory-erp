# Phase Workflow Foundation Threat Model Draft

## Assets

- Phase status and sequencing.
- Phase assignee and deadline.
- Project membership authority.
- Server-derived actor identity.
- Optimistic concurrency token.

## Trust Boundaries

- Browser may send requested edits only.
- Browser must not send actor employee id, workspace, permission, role, started/completed timestamps, or direct status in generic PATCH.
- Server derives actor from `auth.getUser()` and `employees.auth_user_id`.
- Server validates workspace, permission, project membership, project status, phase ownership, assignee membership, and transition legality.

## Primary Risks

- Cross-project phase mutation by changing URL/body IDs.
- Assigning work to inactive employees or non-members.
- Reopening/completing stale phase state after another user changed it.
- Broad browser UPDATE policy bypassing server transition rules.
- Misleading progress if client sends progress as authority.
- Duplicate `order_index` causing wrong lock state.
- Project `CANCELLED` still allowing phase mutation.

## Required Controls

- Phase mutations through server route only for foundation.
- `expectedUpdatedAt` required for update/transition after rollout.
- Unknown fields return 422.
- Invalid transition returns 409.
- Project cancelled mutation returns 409.
- Assignee validation checks `employees` active state and active `project_members`.
- RLS SELECT can mirror `can_view_project(project_id)`.
- No browser INSERT/UPDATE/DELETE policy in foundation.

## Deferred Controls

- Activity log for transition reason and assignee changes.
- Notification fanout.
- Phase template provenance.
- Task assignment relation validation.
