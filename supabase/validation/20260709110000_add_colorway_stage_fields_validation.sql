-- Read-only validation for 20260709110000_add_colorway_stage_fields.sql.
-- Run before production approval and after migration apply.

select
  count(*) = 11 as phase_colorway_stage_columns_present
from information_schema.columns
where table_schema = 'public'
  and table_name = 'phases'
  and column_name in (
    'colorway_name',
    'colorway_code',
    'stage_type',
    'stage_owner',
    'planned_start_date',
    'planned_end_date',
    'actual_start_date',
    'actual_end_date',
    'progress',
    'next_action',
    'required_review'
  );

select
  to_regclass('public.phases_project_colorway_order_idx') is not null
    as phases_project_colorway_order_idx_present;
