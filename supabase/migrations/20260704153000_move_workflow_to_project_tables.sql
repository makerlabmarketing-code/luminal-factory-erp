-- Production migration recovery marker.
--
-- The original 20260704153000 payload moved workflow data from
-- public.system_settings into early projects/phases/tasks columns. Production
-- already has those core tables through later reviewed work, but with a
-- different durable schema shape. Replaying the original payload would attempt
-- incompatible inserts and grants against live production objects.
--
-- Keep this timestamp as a no-op tombstone so Supabase can reconcile migration
-- history without promoting the obsolete schema/data migration.

do $$
begin
  raise notice '20260704153000 obsolete workflow migration intentionally skipped; recovery marker only.';
end $$;
