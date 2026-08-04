import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('Attendance current-shift state regression', () => {
  const client = source('app/staff/attendance/AttendanceView.tsx');
  const route = source('app/api/staff/attendance/route.ts');
  const service = source('services/attendanceService.ts');

  it('renders the start action for NO_OPEN_SHIFT', () => {
    expect(client).toMatch(/useState<AttendanceShiftState>\('NO_OPEN_SHIFT'\)/);
    expect(client).toContain("'Bắt đầu ca'");
  });

  it('renders the end action only for ACTIVE_SHIFT_TODAY', () => {
    expect(client).toMatch(/shiftState === 'ACTIVE_SHIFT_TODAY'[\s\S]*'Kết thúc ca'/);
    expect(client).not.toContain('TẮT MÁY VỀ');
  });

  it('distinguishes a stale shift from a current active shift', () => {
    expect(route).toMatch(/resolveAttendanceShiftState\(openRecord, now\)/);
    expect(route).toMatch(/staleOpenShift: shiftState === 'STALE_OPEN_SHIFT'/);
    expect(client).toContain('Có ca làm trước đó chưa được kết thúc.');
  });

  it('does not render stale elapsed time as today work', () => {
    expect(service).toMatch(/if \(isOpenAttendanceRecordStale\(record, now\)\) return 0/);
    expect(client).not.toMatch(/staleOpenShift[\s\S]{0,400}formatWorkedDuration/);
  });

  it('calculates shift units only for completed records', () => {
    expect(service).toMatch(/getFinalizedShiftUnitsForRecord/);
    expect(service).toMatch(/if \(!isAttendanceRecordComplete\(record\)\) return 0/);
    expect(client).toMatch(/getFinalizedShiftUnitsForRecord\(record\)/);
  });

  it('creates one normalized attendance row for check-in', () => {
    expect((route.match(/\.insert\(\[/g) || [])).toHaveLength(1);
    expect(route).toMatch(/employee_id: authContext\.employee\.id/);
    expect(route).toMatch(/\.select\(ATTENDANCE_SELECT\)\s*\.single\(\)/);
  });

  it('denies duplicate check-in before and after location acquisition', () => {
    expect(route).toContain('attendance_already_checked_in');
    expect(route).toMatch(/openRecordAfterLocation/);
    expect(route).toMatch(/existingShiftAfterLocation/);
  });

  it('applies check-in locally and reevaluates the current shift after checkout', () => {
    expect(client).toContain('applyMutationRecord(result.record)');
    expect(client).toMatch(/if \(action === 'check_out'\)[\s\S]*loadAttendanceData\(historyMonthInput/);
    expect(client).toMatch(/showLoading: false/);
  });

  it('returns the completed aggregate record after checkout', () => {
    expect(route).toMatch(/code: 'attendance_checked_out'[\s\S]*record: data,[\s\S]*capabilities/);
    expect(route).toMatch(/\.is\('check_out', null\)\s*\.select\(ATTENDANCE_SELECT\)\s*\.maybeSingle\(\)/);
  });

  it('loads the selected month initially and reconciles mutation rows locally', () => {
    expect(route).toMatch(/getAttendanceRecordByShift\(employee\.id, todayStr, currentShiftName\)/);
    expect(client).toMatch(/month: historyMonthInput/);
    expect(client).toMatch(/setAttendanceHistory\(payload\.attendanceHistory\)/);
    expect(client).toMatch(/setAttendanceHistory\(\(previous\) =>/);
  });

  it('keeps a completed current shift out of the start state', () => {
    expect(route).toMatch(/shiftState,\s*currentShift:/);
    expect(client).toMatch(/setShiftState\(payload\.shiftState\)/);
    expect(client).toMatch(/canContinueAttendanceShift/);
    expect(client).toMatch(/todayRecord\?\.check_out && !canStartCurrentShift/);
  });

  it('shows the completed shift facts and does not invite a retry', () => {
    expect(client).toContain('Ca hiện tại đã được ghi nhận. Bạn không cần chấm công lại.');
    expect(client).toContain('Ca: {todayRecord.shift_name}');
    expect(client).toContain('Trạng thái: Đã ghi nhận');
    expect(client).toContain('Vào: {todayRecord.check_in?.slice(0, 5)}');
    expect(client).toContain('Ra: {todayRecord.check_out?.slice(0, 5)}');
  });

  it('preserves stable attendance state on checkout failure', () => {
    const failureBlock = client.slice(
      client.indexOf('if (!response.ok)'),
      client.indexOf("if (!result?.attendance")
    );
    expect(failureBlock).toMatch(/setMutationError/);
    expect(failureBlock).not.toMatch(/setShiftState|setCurrentShift|setAttendanceHistory/);
  });

  it('locks submission synchronously against double click', () => {
    expect(client).toMatch(/if \(submitLockRef\.current\) return/);
    expect(client).toMatch(/submitLockRef\.current = true/);
    expect(client).toMatch(/disabled=\{submitting\}/);
  });

  it('requests GPS only for explicit check-in', () => {
    expect(client).toMatch(/if \(action === 'check_in'\)[\s\S]*getCurrentPosition\(\)/);
    expect(client).not.toMatch(/if \(action === 'check_out'\)[\s\S]{0,250}getCurrentPosition/);
  });

  it('keeps attendance available when optional Facility enrichment fails', () => {
    expect(route).toMatch(/async function loadOptionalMatchedBranch/);
    expect(route).toMatch(/code: 'facility_lookup_failed'/);
    expect(route).toMatch(/return null/);
  });

  it('retains the selected month through check-in and check-out', () => {
    expect(client).toMatch(/month: historyMonthInput/);
    expect(client).not.toMatch(/setHistoryMonthInput\([^v]/);
  });

  it('uses the Vietnam business timezone for server timestamps', () => {
    expect(route).toMatch(/businessDateFromInstant\(now\)/);
    expect(route).toMatch(/timeZone: 'Asia\/Ho_Chi_Minh'/);
    expect(service).toMatch(/BUSINESS_TIME_ZONE/);
  });

  it('uses a compact responsive primary action', () => {
    expect(client).toMatch(/min-h-12 w-full max-w-xs/);
    expect(client).not.toMatch(/w-36 h-36|rounded-full border-4|hover:scale-105/);
  });
});
