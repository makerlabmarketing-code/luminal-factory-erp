import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_ATTENDANCE_SHIFTS, getAttendanceShiftName } from '../services/attendanceService';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('Admin Attendance manual-entry flow', () => {
  it('exposes the resolver-owned default shifts in business order', () => {
    expect(DEFAULT_ATTENDANCE_SHIFTS.map((shift) => shift.shift_name)).toEqual([
      'Ca Sáng',
      'Ca Chiều',
      'Ca Tối',
    ]);
    expect(getAttendanceShiftName(new Date('2026-08-04T01:00:00.000Z'))).toBe('Ca Sáng');
    expect(getAttendanceShiftName(new Date('2026-08-04T07:00:00.000Z'))).toBe('Ca Chiều');
    expect(getAttendanceShiftName(new Date('2026-08-04T13:00:00.000Z'))).toBe('Ca Tối');
  });

  it('falls back to the resolver-owned defaults only when the shifts directory is empty', () => {
    const attendanceData = source('services/server/attendanceData.ts');

    expect(attendanceData).toMatch(/shiftResult\?\.data\?\.length[\s\S]*DEFAULT_ATTENDANCE_SHIFTS/);
    expect(attendanceData).toContain("supabase.from('shifts')");
  });

  it('patches the affected record locally and closes only after confirmed mutation success', () => {
    const page = source('app/admin/attendance/page.tsx');
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');

    expect(page).toMatch(/setAttendanceRecords\(\(current\) =>/);
    expect(page).not.toMatch(/onRecordChanged={[\s\S]{0,200}loadData/);
    expect(modal).toMatch(/onRecordChanged\(record, 'create'\);\s*onClose\(\);/);
    expect(modal).toMatch(/onRecordChanged\(record, 'update'\);\s*onClose\(\);/);
    expect(modal).toMatch(/onRecordChanged\(record, 'delete'\);\s*onClose\(\);/);
  });

  it('keeps notification callbacks stable so a toast cannot retrigger the Attendance GET effect', () => {
    const notifications = source('component/NotificationContext.tsx');

    expect(notifications).toMatch(/const showToast = useCallback/);
    expect(notifications).toMatch(/const showConfirm = useCallback/);
    expect(notifications).toMatch(/const contextValue = useMemo/);
  });
});
