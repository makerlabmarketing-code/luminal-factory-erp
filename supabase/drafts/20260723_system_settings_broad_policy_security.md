# Batch 3D2 system_settings broad-policy security review

## Scope

Remove the two legacy broad RLS policies on `public.system_settings`:

- `Allow anon all`
- `Allow authenticated all`

This package does not add replacement browser policies because Batch 3D1 removed runtime reads/writes from `system_settings` and disabled the central settings UI.

## Security impact

- Anonymous and authenticated browser roles should no longer have unrestricted row access through these policies.
- RLS remains enabled as defense in depth.
- No grants, service-role exposure, SECURITY DEFINER function, storage policy, Auth mutation, or live data mutation is introduced.
- Existing server configuration reads remain environment-backed (`SMTP_*`, `COMPANY_BANK_*`) and not database-backed.

## Approval gate

Production execution still requires the approved Supabase GitHub Integration path. Do not run direct SQL from Codex Cloud.
