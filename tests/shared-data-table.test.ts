import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clampDataTablePage } from '../hooks/useDataTableState';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('shared data-table infrastructure', () => {
  it('keeps a responsive minimum-height table region with accessible loading semantics', () => {
    const table = source('component/data-table/DataTable.tsx');
    expect(table).toMatch(/overflow-x-auto/);
    expect(table).toMatch(/min-h-\[14rem\]/);
    expect(table).toMatch(/min-h-\[22rem\]/);
    expect(table).toMatch(/aria-busy=\{isRefreshing\}/);
    expect(table).toMatch(/aria-live="polite"/);
    expect(table).toContain('Đang tải dữ liệu bảng...');
    expect(table).toContain('Số dòng mỗi trang');
  });

  it('clamps pagination after the final row is deleted', () => {
    expect(clampDataTablePage(3, 20, 10)).toBe(2);
    expect(clampDataTablePage(1, 0, 10)).toBe(1);
  });

  it('keeps Attendance shells mounted and patches authoritative mutation rows without duplicate GETs', () => {
    const staff = source('app/staff/attendance/AttendanceView.tsx');
    const admin = source('app/admin/attendance/page.tsx');
    const modal = source('app/admin/attendance/components/DailyAttendanceModal.tsx');
    expect(staff).not.toMatch(/if \(fetching\) \{/);
    expect(staff).toMatch(/DataTableShell label="Lịch sử chấm công"/);
    expect(staff).toMatch(/applyMutationRecord\(result\.record\)/);
    expect(admin).not.toMatch(/if \(loading\) \{/);
    expect(admin).toMatch(/DataTableShell label="Lịch chấm công theo tháng"/);
    expect(modal).not.toMatch(/onReload/);
    expect(modal).toMatch(/onRecordChanged\(record, 'update'\)/);
    expect(modal).toMatch(/onRecordChanged\(record, 'delete'\)/);
    expect(modal).toMatch(/onRecordChanged\(record, 'create'\)/);
  });
});
