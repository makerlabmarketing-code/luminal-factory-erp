# Facility active-state and stable-code security review

Status: `LIVE_APPROVAL_REQUIRED`.

- No browser Supabase write policy should be added for `public.facilities`.
- Facility mutations should remain behind `/api/admin/facilities` and `services/server/adminFacilities.ts`.
- Server authorization should continue requiring `ADMIN_WORKSPACE` plus either `SYSTEM_SETTINGS_MANAGE`, `SYSTEM_SETTINGS_VIEW`, or `ATTENDANCE_MANAGE` according to the operation.
- The validation package checks for broad authenticated INSERT/UPDATE/DELETE/ALL policies that lack permission or workspace predicates.
- The forward package does not grant permissions, expose service-role credentials, create storage policies, deploy RPCs, or mutate Auth users.
