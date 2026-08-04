import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveAttendanceEmployeeSelection } from '../lib/attendanceEmployeeSelection';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Admin Attendance mutation regressions', () => {
  it('keeps the visible Maker Lab name paired with the stable Employee row id', () => {
    const selection = resolveAttendanceEmployeeSelection(
      [{ id: 42, full_name: 'Maker Lab', email: 'maker@example.test' }],
      42,
    );

    expect(selection.displayName).toBe('Maker Lab');
    expect(selection.employeeId).toBe('42');
    expect(selection.employee?.id).toBe(42);
  });

  it('does not treat a display name, email, or auth user id as an Employee id', () => {
    const employees = [{ id: 42, full_name: 'Maker Lab', email: 'maker@example.test' }];

    const cleared = resolveAttendanceEmployeeSelection(employees, '');
    expect(cleared.employee).toBeNull();
    expect(cleared.employeeId).toBe('');
    expect(cleared.displayName).toBe('');
    expect(resolveAttendanceEmployeeSelection(employees, 'Maker Lab').employee).toBeNull();
    expect(resolveAttendanceEmployeeSelection(employees, 'maker@example.test').employee).toBeNull();
    expect(resolveAttendanceEmployeeSelection(employees, 'auth-user-42').employee).toBeNull();
  });

  it('retains and clears the selected Employee id together with the visible selector', () => {
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');

    expect(modal).toContain('setSelectedEmployeeId(currentEmpId)');
    expect(modal).toContain('value={selectedEmployeeId}');
    expect(modal).toContain('value={employeeSelection.employeeId}');
    expect(modal).toContain('Chá»n nhÃ¢n sá»±');
    expect(modal).toContain('setSelectedEmployeeId(event.target.value)');
  });

  it('accepts the JSON numeric Employee id and validates the stable target row server-side', () => {
    const route = source('app/api/admin/attendance/route.ts');

    expect(route).toContain('function numericId(value: unknown): string | null');
    expect(route).toContain('const employeeId = numericId(body.employeeId);');
    expect(route).toContain(".from('employees')");
    expect(route).toContain(".select('id, status, is_active')");
    expect(route).toContain('await validateTargetEmployee(employeeId);');
    expect(route).toContain('reason: requiredReason(body)');
  });

  it('keeps create, update, and delete on their distinct API contracts', () => {
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');
    const service = source('services/attendanceService.ts');
    const route = source('app/api/admin/attendance/route.ts');

    expect(service).toContain('employeeId: params.employee.id');
    expect(service).toContain("method: 'POST'");
    expect(service).toContain("method: 'PATCH'");
    expect(service).toContain("method: 'DELETE'");
    expect(route).toContain('export async function POST');
    expect(route).toContain('export async function PATCH');
    expect(route).toContain('export async function DELETE');
    expect(modal).toContain('reason: createReason.trim()');
    expect(modal).toContain('reason: adjustmentReason.trim()');
  });

  it('does not silently submit unchanged rows and scopes loading to the affected action', () => {
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');

    expect(modal).toContain('isRowDirty(targetRecord, rowData)');
    expect(modal).toContain('[pendingActions, setPendingActions]');
    expect(modal).toContain('isRowPending(record.id)');
    expect(modal).toContain('type="button"');
    expect(modal).toContain("focusReason('adjustment')");
    expect(modal).toContain('showConfirm(');
  });

  it('keeps server-owned time validation and recalculation boundaries intact', () => {
    const route = source('app/api/admin/attendance/route.ts');
    const rpc = source('supabase/drafts/20260804_attendance_multi_check_admin_mutations_forward.sql');

    expect(route).toContain('function requiredTime');
    expect(route).toContain('validateTimeOrdering(checkIn, checkOut)');
    expect(rpc).toContain('worked_minutes := greatest(0');
    expect(rpc).toContain('total_salary = case when worked_hours <= 0 or hourly_rate <= 0');
    expect(rpc).toContain('public.attendance_audit_state(before_row)');
  });

  it('does not couple normal Admin mutations to Attendance recovery or Staff behavior', () => {
    const route = source('app/api/admin/attendance/route.ts');
    const staffRoute = source('app/api/staff/attendance/route.ts');
    const gate = source('lib/attendanceManualMutationGate.ts');

    expect(route).not.toContain('ATTENDANCE_RECOVERY_ENABLED');
    expect(route).toContain("hasPermission(authContext, 'ATTENDANCE_MANAGE')");
    expect(gate).toContain('independent from recovery');
    expect(staffRoute).toContain('staff_attendance_multi_mutation');
  });
});
