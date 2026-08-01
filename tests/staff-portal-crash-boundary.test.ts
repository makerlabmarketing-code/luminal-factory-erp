import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('staff portal crash boundary', () => {
  it('loads the Staff Portal through a controlled server state instead of throwing before render', () => {
    const page = source('app/staff/page.tsx');
    const service = source('services/server/staffPortalData.ts');
    const boundary = source('app/staff/error.tsx');

    expect(page).toMatch(/getStaffPortalLoadState/);
    expect(page).toMatch(/if \(!portalState\.ok\)/);
    expect(page).toMatch(/StaffPortalStatusCard/);
    expect(page).not.toMatch(/await getAuthenticatedStaffPortalData\(\)/);
    expect(service).toMatch(/export async function getStaffPortalLoadState/);
    expect(service).toMatch(/return \{ ok: false, error: errorState \}/);
    expect(boundary).toMatch(/StaffPortalErrorBoundary/);
    expect(boundary).toMatch(/staff_portal_unhandled_failure/);
  });

  it('keeps core Staff Portal authority on active employee and STAFF_WORKSPACE without Project Membership', () => {
    const service = source('services/server/staffPortalData.ts');
    const auth = source('services/server/auth.ts');

    expect(service).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
    expect(auth).toMatch(/isActiveEmployee\(serverEmployee\)/);
    expect(auth).toMatch(/lookupWorkspaceAccess\(authContext, 'STAFF_WORKSPACE'\)/);
    expect(service).not.toMatch(/project_members|PROJECT_VIEW|PROJECT_MANAGE|project_membership_required/);
  });

  it('maps expected auth failures to Vietnamese in-page states', () => {
    const service = source('services/server/staffPortalData.ts');
    const page = source('app/staff/page.tsx');

    [
      'session_not_verified',
      'employee_not_connected',
      'employee_inactive',
      'staff_workspace_required',
      'staff_portal_unavailable',
      'staff_portal_unhandled_failure',
    ].forEach((code) => {
      expect(service).toContain(code);
    });
    expect(service).toContain('Phiên đăng nhập chưa được xác nhận. Vui lòng đăng nhập lại.');
    expect(service).toContain('Tài khoản chưa được liên kết với hồ sơ nhân sự.');
    expect(service).toContain('Hồ sơ nhân sự hiện không hoạt động.');
    expect(service).toContain('Tài khoản chưa được cấp quyền truy cập khu vực nhân viên.');
    expect(page).toContain('Không thể mở khu vực nhân viên');
    expect(page).toContain('Mã hỗ trợ:');
  });

  it('uses the staff request session for facility enrichment and treats facility failure as optional', () => {
    const service = source('services/server/staffPortalData.ts');
    const attendanceRoute = source('app/api/staff/attendance/route.ts');

    expect(service).toMatch(/loadFacilityDirectory\(await createClient\(\)\)/);
    expect(service).not.toMatch(/getFacilityDirectory/);
    expect(service).toMatch(/warnings\.push\(\{/);
    expect(service).toMatch(/code: 'facility_lookup_failed'/);
    expect(service).toMatch(/assignedBranch: findAssignedBranch\(authContext\.employee, branches\)/);
    expect(attendanceRoute).toMatch(/loadOptionalMatchedBranch/);
    expect(attendanceRoute).toMatch(/return null/);
    expect(attendanceRoute).toMatch(/localBranchName: resolveBranchName\(matchedBranch\)/);
  });

  it('keeps attendance recovery disabled and normal attendance independent from recovery', () => {
    const adminAttendanceRoute = source('app/api/admin/attendance/route.ts');
    const staffAttendanceRoute = source('app/api/staff/attendance/route.ts');

    expect(adminAttendanceRoute).toMatch(/isRecoveryEnabled\(process\.env\.ATTENDANCE_RECOVERY_ENABLED\)/);
    expect(staffAttendanceRoute).not.toMatch(/ATTENDANCE_RECOVERY_ENABLED|attendance_recovery_disabled/);
    expect(staffAttendanceRoute).toMatch(/employee_id: authContext\.employee\.id/);
    expect(staffAttendanceRoute).toMatch(/getOpenAttendanceRecord\(authContext\.employee\.id\)/);
  });

  it('logs sanitized Staff Portal failures with correlation IDs and no raw secrets', () => {
    const service = source('services/server/staffPortalData.ts');
    const attendanceRoute = source('app/api/staff/attendance/route.ts');
    const boundary = `${service}${attendanceRoute}`;

    expect(boundary).toMatch(/crypto\.randomUUID\(\)/);
    expect(boundary).toMatch(/console\.error\('\[staff-portal\]'/);
    expect(boundary).toMatch(/supabaseErrorCode/);
    expect(boundary).toMatch(/retryable/);
    expect(boundary).not.toMatch(/access_token|refresh_token|cookie|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|databaseUrl|DATABASE_URL/);
  });

  it('does not expose raw database messages to the Staff Portal client', () => {
    const page = source('app/staff/page.tsx');
    const attendanceRoute = source('app/api/staff/attendance/route.ts');

    expect(page).not.toMatch(/supabase|postgres|PostgreSQL|PGRST|42501|error\.message/);
    expect(attendanceRoute).not.toMatch(/supabase_error_message|error\.message,\s*code: 'attendance_load_failed'/);
  });

  it('keeps optional task, payroll and expense sections local to visited tabs', () => {
    const portal = source('app/staff/portal/StaffPortalContent.tsx');
    const payroll = source('app/staff/payroll/PayrollView.tsx');
    const tasks = source('app/staff/tasks/TasksView.tsx');

    expect(portal).toMatch(/visitedTabs/);
    expect(portal).toMatch(/visitedTabs\.tasks/);
    expect(portal).toMatch(/visitedTabs\.payroll/);
    expect(payroll).toMatch(/setError/);
    expect(payroll).toMatch(/Thử lại/);
    expect(tasks).toMatch(/catch \(error\)/);
    expect(tasks).toMatch(/showToast\('Thất bại'/);
    expect(tasks).not.toMatch(/throw new Error/);
  });
});
