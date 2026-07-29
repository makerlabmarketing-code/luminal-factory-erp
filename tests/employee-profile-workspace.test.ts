import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('employee profile workspace contract', () => {
  const list = read('app/admin/employees/AdminEmployeesClient.tsx');
  const detail = read('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
  const actions = read('services/server/adminEmployeeActions.ts');
  const staff = read('app/staff/profile/ProfileView.tsx');
  const staffRoute = read('app/api/staff/profile/route.ts');
  const persistence = read('services/server/staffProfilePersistence.ts');
  const permissions = read('lib/account-permissions.ts');

  it('opens detail from the list and has no list update mutation', () => {
    expect(list).toContain('Xem chi tiết');
    expect(list).not.toContain('Sửa nhanh');
    expect(list).not.toContain("method: 'PATCH'");
  });
  it('derives editable versus read-only detail controls from server capability', () => {
    expect(detail).toContain('data.capabilities.canEditEmployee ? <form');
    expect(detail).toContain('<Field label="Họ tên"');
    expect(detail).toContain("value || 'Chưa cập nhật'");
  });
  it('shows save only for real dirty fields and sends changed fields only', () => {
    expect(detail).toContain('const dirtyFields');
    expect(detail).toContain('const editorActions = dirty &&');
    expect(detail).toContain('Object.fromEntries(dirtyFields.map');
    expect(detail).toContain("finance: ['bankName', 'bankAccountNumber']");
  });
  it('keeps canonical facility and unchanged columns intact', () => {
    expect(actions).toContain("payload.branch_code = await validateFacilityAssignment(input.department, current.branch_code)");
    expect(actions).toContain("hasOwnProperty.call(input, 'phone')");
    expect(actions).toContain("hasOwnProperty.call(input, 'title')");
    expect(actions).toContain("hasOwnProperty.call(input, 'employmentStatus')");
    expect(actions).toContain("hasOwnProperty.call(input, 'bankName')");
    expect(actions).toContain("hasOwnProperty.call(input, 'bankAccountNumber')");
  });
  it('keeps optional enrichment section-local', () => {
    expect(detail).toContain('Hồ sơ chính vẫn dùng được');
    expect(detail).toContain('Thử tải lại');
  });
  it('protects staff own-profile fields and returns persisted readback', () => {
    expect(staffRoute).toContain("requireWorkspaceAccess('STAFF_WORKSPACE')");
    expect(staffRoute).toContain("new Set(['phone', 'bankName', 'bankAccountNumber'])");
    expect(staffRoute).toContain('employeeId = authContext.employee.id');
    expect(persistence).toContain(".eq('id', employeeId)");
    expect(persistence).toContain(".select('phone, bank_name, bank_account_number')");
    expect(staff).toContain("'Đã cập nhật thông tin cá nhân.'");
    expect(staff).toContain('setWorker((current)');
  });
  it('localizes grouped permissions and uses centralized account management', () => {
    expect(permissions).toContain('Xem hồ sơ nhân sự');
    expect(permissions).toContain('Xem dữ liệu chấm công');
    expect(permissions).toContain('Quản lý tài khoản và quyền truy cập');
    expect(permissions).toContain('PERMISSION_MANAGEMENT_PATH = "/admin/accounts"');
    expect(detail).toContain('getPermissionPresentation');
    expect(detail).toContain('Mở trình quản lý tài khoản và quyền');
  });
  it('preserves route and dirty state on error without a full reload', () => {
    expect(detail).toContain('setError(message)');
    expect(detail).toContain("window.addEventListener('beforeunload'");
    expect(detail).not.toContain('window.location.reload');
  });
});
