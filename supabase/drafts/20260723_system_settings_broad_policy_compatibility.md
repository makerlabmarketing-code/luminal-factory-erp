# Batch 3D2 system_settings broad-policy compatibility and backfill notes

## Application compatibility

Batch 3D1 already removed runtime source-path reads and writes to `public.system_settings` and disabled the central settings UI. This policy remediation therefore should not break active application workflows.

Compatibility assumptions before rollout:

1. `app/`, `component/`, `lib/`, `services/`, and `utils/` contain no runtime Supabase query to `system_settings`.
2. SMTP configuration is read from server environment variables.
3. VietQR/bank configuration is exposed through the server API backed by environment variables.
4. No browser UI depends on direct `system_settings` reads or writes.

## Backfill impact

No backfill is required. This package only drops broad policies and enables RLS if the table exists.

## Rollback

Rollback is the companion SQL file, but it restores broad legacy access and must be treated as a separate live security decision.
