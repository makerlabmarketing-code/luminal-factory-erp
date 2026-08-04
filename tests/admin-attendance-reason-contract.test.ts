import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADMIN_ATTENDANCE_CREATE_REASON,
  normalizeAdminAttendanceCreateReason,
  normalizeRequiredAdminAttendanceReason,
} from '../lib/adminAttendanceReason';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Admin Attendance reason contract', () => {
  it.each([undefined, null, '', ' ngắn '])('defaults a missing or short CREATE reason (%s)', (reason) => {
    expect(normalizeAdminAttendanceCreateReason(reason)).toBe(DEFAULT_ADMIN_ATTENDANCE_CREATE_REASON);
  });

  it('preserves a trimmed valid CREATE reason', () => {
    expect(normalizeAdminAttendanceCreateReason('  Bổ sung theo phiếu giấy  ')).toBe('Bổ sung theo phiếu giấy');
  });

  it.each([undefined, '', ' quá ngắn '])('rejects a missing or short audited reason (%s)', (reason) => {
    expect(normalizeRequiredAdminAttendanceReason(reason)).toBeNull();
  });

  it('keeps UPDATE and cancellation required while every CREATE audit receives a reason', () => {
    const route = source('app/api/admin/attendance/route.ts');
    expect(route).toMatch(/operation: 'CREATE'[\s\S]*reason: normalizeAdminAttendanceCreateReason\(body\.reason\)/);
    expect(route).toMatch(/operation: 'UPDATE'[\s\S]*reason: requiredReason\(body\)/);
    expect(route).toContain('attendance_cancellation_reason_required');
    expect(DEFAULT_ADMIN_ATTENDANCE_CREATE_REASON.trim().length).toBeGreaterThanOrEqual(10);
  });

  it('preserves permissions, runtime gating, audited RPC, cancellation, and payroll protection', () => {
    const route = source('app/api/admin/attendance/route.ts');
    const rpc = source('supabase/drafts/20260804_attendance_multi_check_admin_mutations_forward.sql');
    expect(route).toContain("hasPermission(authContext, 'ATTENDANCE_MANAGE')");
    expect(route).toContain('isAttendanceManualMutationEnabled()');
    expect(route).toContain("supabase.rpc('admin_attendance_mutation'");
    expect(rpc).toContain("length(btrim(coalesce(p_reason, ''))) < 10");
    expect(rpc).toContain("status = 'CANCELLED'");
    expect(rpc).toContain('Attendance row is referenced by finalized payroll');
  });

  it('keeps CREATE local, single-shot, and closes only after confirmed success', () => {
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');
    const service = source('services/attendanceService.ts');
    const page = source('app/admin/attendance/page.tsx');
    expect(modal).toContain('Ghi chú bổ sung (không bắt buộc)');
    expect(modal).toMatch(/const record = await upsertAttendanceRecord\([\s\S]*onRecordChanged\(record, 'create'\);\s*onClose\(\);/);
    expect(service.match(/method: 'POST'/g)).toHaveLength(1);
    expect(page).not.toMatch(/onRecordChanged={[\s\S]{0,200}loadData/);
  });
});
