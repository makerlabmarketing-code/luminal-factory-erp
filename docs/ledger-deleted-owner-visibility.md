# Super admin visibility for deleted ledger records

User request: only the super admin may view the deleted-record area. The existing active `OWNER` role is the super admin; no new role or grants are introduced.

- Keep ordinary finance access to active transactions.
- Filter archived rows in the finance service before generating signed attachments or response metadata unless `isSystemOwner` passes.
- Deny direct archived-ledger history requests to other finance users. Filter archived finance events out of employee timelines while advancing the cursor across hidden events.
- Reject attachment changes for archived ledger resources until restored.
- Add a restrictive authenticated SELECT policy alongside the existing admin policy, so direct Supabase reads also hide archived rows from non-owners. A private helper resolves active OWNER identity from the authoritative employee row and `auth.uid()`.
- The staff reimbursement RPC keeps its existing workspace/ownership rules and also excludes deleted records unless the caller is an active OWNER.
- Archive/restore mutations remain owner-only through the existing boundary. No business records or account roles are changed by rollout.

Validation: role-based history tests, RLS role fixtures, full test suite, lint, TypeScript and production build. Two obsolete source assertions from the previous UI release are updated: remove a hard-coded table pixel width and use the current approved empty-state label.

Rollout: merge, apply `20261021041420_ledger_deleted_owner_visibility.sql`, verify policy/ACLs and migration version, verify owner UI. Rollback: revert the service commit; drop the new restrictive policy and private helper/schema using the rollback file. Database rollback broadens direct read visibility to its previous behavior and must be deliberate. No data backfill.
