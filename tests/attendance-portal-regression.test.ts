import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('staff attendance portal regression contract', () => {
  it('keeps staff attendance behind STAFF_WORKSPACE without project membership authority', () => {
    const route = source('app/api/staff/attendance/route.ts');
    const staffPortalData = source('services/server/staffPortalData.ts');
    const attendanceData = source('services/server/attendanceData.ts');

    expect(route).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
    expect(staffPortalData).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
    expect(route).not.toMatch(/project_members|requirePhaseMutationAccess|PROJECT_OWNER|PROJECT_MANAGER|PROJECT_VIEW|PROJECT_MANAGE|CREATIVE_LEAD|CONTRIBUTOR/);
    expect(staffPortalData).not.toMatch(/project_members|requirePhaseMutationAccess/);
    expect(attendanceData).not.toMatch(/project_members|requirePhaseMutationAccess/);
  });

  it('uses live facility columns for attendance GPS matching', () => {
    const route = source('app/api/staff/attendance/route.ts');
    const adminEmployeeData = source('services/server/adminEmployeeData.ts');
    const directory = source('services/server/facilityDirectory.ts');

    expect(route).toMatch(/getFacilityDirectory/);
    expect(route).toMatch(/branch\.code/);
    expect(adminEmployeeData).toMatch(/getFacilityDirectory/);
    expect(directory).toMatch(/FACILITY_SELECT/);
    expect(directory).toMatch(/is_active/);
  });

  it('derives staff attendance identity and timestamps server-side', () => {
    const route = source('app/api/staff/attendance/route.ts');
    const client = source('app/staff/attendance/AttendanceView.tsx');

    expect(route).toMatch(/STAFF_ATTENDANCE_ALLOWED_FIELDS/);
    expect(route).toMatch(/assertKnownPostFields\(body\)/);
    expect(route).not.toMatch(/body\.(employeeId|checkIn|checkOut|checkInTime|checkOutTime)/);
    expect(route).toMatch(/employee_id: authContext\.employee\.id/);
    expect(route).toMatch(/const now = new Date\(\)/);
    expect(client).toMatch(/body: JSON\.stringify\(\{ userLat, userLng \}\)/);
    expect(client).not.toMatch(/employeeId|checkInTime|checkOutTime/);
  });

  it('finds an open attendance session for the actor instead of only today', () => {
    const route = source('app/api/staff/attendance/route.ts');

    expect(route).toMatch(/async function getOpenAttendanceRecord\(employeeId: number \| string, workDate\?: string\)/);
    expect(route).toMatch(/const openRecord = await getOpenAttendanceRecord\(authContext\.employee\.id\)/);
    expect(route).toMatch(/query = query\.eq\('work_date', workDate\)/);
  });

  it('returns stable staff attendance error codes without exposing raw database errors', () => {
    const route = source('app/api/staff/attendance/route.ts');
    const client = source('app/staff/attendance/AttendanceView.tsx');

    [
      'attendance_unauthenticated',
      'attendance_workspace_required',
      'attendance_employee_inactive',
      'attendance_employee_not_found',
      'attendance_invalid_payload',
      'attendance_location_out_of_range',
      'attendance_already_checked_out',
      'attendance_load_failed',
    ].forEach((code) => {
      expect(route).toContain(code);
    });
    expect(route).not.toMatch(/supabase_error_message|error\.message,\s*code: 'attendance_load_failed'/);
    expect(client).toMatch(/messageForAttendanceError/);
  });

  it('prevents double submit while check-in or check-out is in flight', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');
    const loading = source('component/GlobalLoading.tsx');

    expect(client).toMatch(/const \[submitting, setSubmitting\] = useState\(false\)/);
    expect(client).toMatch(/if \(submitting\) return/);
    expect(client).toMatch(/setSubmitting\(true\)/);
    expect(client).toMatch(/setSubmitting\(false\)/);
    expect(client).toMatch(/disabled=\{submitting\}/);
    expect(client).toMatch(/showGlobalLoading\(isInShift \? 'Đang kết thúc ca\.\.\.' : 'Đang ghi nhận vào ca\.\.\.'\)/);
    expect(loading).toMatch(/Đang ghi nhận vào ca/);
    expect(loading).toMatch(/Đang kết thúc ca/);
  });

  it('keeps staff portal attendance initial load free of project and employee-list fetches', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');
    const route = source('app/api/staff/attendance/route.ts');

    expect(client).toMatch(/\/api\/staff\/attendance/);
    expect(client).not.toMatch(/\/api\/admin\/employees|\/api\/admin\/projects|project_members/);
    expect(route).not.toMatch(/from\('project_members'\)/);
    expect(route).toMatch(/includeDirectory: false/);
  });
});
