-- Read-only postflight. Check validated constraint includes all ten events.
select conname, convalidated, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.project_activity'::regclass
and conname='project_activity_activity_type_check';
select activity_type,count(*) from public.project_activity group by activity_type;
