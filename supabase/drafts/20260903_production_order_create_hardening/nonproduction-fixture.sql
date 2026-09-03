-- NON-PRODUCTION ONLY. Run manually with an authenticated test user that has
-- ADMIN_WORKSPACE, PROJECT_MANAGE and TASK_MANAGE after replacing the fixture IDs.
-- This transaction always rolls back and never changes inventory.

begin;

-- Expected checks for an operator-run fixture:
-- 1. A valid canonical payload returns success=true and creates exactly:
--    1 order, 12 stages, 11 dependencies, 12 tasks, and the activity rows.
-- 2. completedQuantity/status/materialRequirements/createdByEmployeeId are rejected.
-- 3. A non-canonical stage array is rejected.
-- 4. A manager or creative lead outside the required active project role is rejected.
-- 5. A repeated productionCode returns duplicate_production_code without partial rows.
-- 6. No inventory, procurement, material quantity, attachment, or notification row changes.

select 'OPERATOR_INPUT_REQUIRED' as fixture_status;

rollback;
