import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('employee admin list and account actions slice', () => {
  it('loads the admin employee list through a server DTO instead of a Client Component query', () => {
    const pageSource = source('app/admin/employees/page.tsx');
    const clientSource = source('app/admin/employees/AdminEmployeesClient.tsx');
    const serviceSource = source('services/server/adminEmployeeData.ts');

    expect(pageSource).not.toMatch(/['"]use client['"]/);
    expect(pageSource).toMatch(/getAdminEmployeeListData/);
    expect(pageSource).toMatch(/dynamic = 'force-dynamic'/);
    expect(clientSource).toMatch(/['"]use client['"]/);
    expect(clientSource).not.toMatch(/supabase|from\(['"]employees['"]\)|auth_user_id|qr_token|bank_account_number/);
    expect(serviceSource).toMatch(/EmployeeListItem/);
    expect(serviceSource).toMatch(/requireAdminEmployeePermission\('EMPLOYEE_VIEW'\)/);
    expect(serviceSource).toMatch(/from\('employees'\)/);
    expect(serviceSource).not.toMatch(/\.eq\(['"]auth_user_id['"]/);
  });

  it('requires ADMIN_WORKSPACE and EMPLOYEE_VIEW to read the full employee list', () => {
    const serviceSource = source('services/server/adminEmployeeData.ts');

    expect(serviceSource).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(serviceSource).toMatch(/hasPermission\(authContext, permissionCode\)/);
    expect(serviceSource).toMatch(/permission_forbidden/);
  });

  it('keeps current employee lookup on production-safe employee columns', () => {
    const serverAuthSource = source('services/server/auth.ts');
    const serviceSource = source('services/server/adminEmployeeData.ts');

    expect(serverAuthSource).toMatch(/STAFF_EMPLOYEE_SELECT/);
    expect(serverAuthSource).toMatch(/\.eq\('auth_user_id', user\.id\)/);
    expect(serverAuthSource).toMatch(/\.maybeSingle\(\)/);
    expect(serverAuthSource).not.toMatch(/STAFF_EMPLOYEE_SELECT =\n  '.*branch,/);
    expect(serverAuthSource).not.toMatch(/STAFF_EMPLOYEE_SELECT =\n  '.*base_salary_per_hour/);
    expect(serviceSource).not.toMatch(/select\('.*branch,/);
  });

  it('distinguishes employee lookup database errors from authorization denial', () => {
    const serverAuthSource = source('services/server/auth.ts');
    const lookupErrorStart = serverAuthSource.indexOf('if (employeeError)');
    const lookupErrorEnd = serverAuthSource.indexOf('if (!employee)', lookupErrorStart);
    const lookupErrorBlock = serverAuthSource.slice(lookupErrorStart, lookupErrorEnd);

    expect(lookupErrorBlock).toMatch(/reason: 'database_error'/);
    expect(lookupErrorBlock).toMatch(/failureStage: 'employee_lookup'/);
    expect(lookupErrorBlock).toMatch(/supabase_error_code/);
    expect(lookupErrorBlock).not.toMatch(/permission_forbidden|workspace_forbidden/);
  });

  it('keeps Staff Workspace profile reads on the current employee only', () => {
    const staffPortalData = source('services/server/staffPortalData.ts');
    const staffProfileRoute = source('app/api/staff/profile/route.ts');

    expect(staffPortalData).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
    expect(staffProfileRoute).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
    expect(staffProfileRoute).toMatch(/\.eq\('id', authContext\.employee\.id\)/);
  });

  it('renders account status labels and account actions from DTO state', () => {
    const clientSource = source('app/admin/employees/AdminEmployeesClient.tsx');

    expect(clientSource).toMatch(/Tài khoản hệ thống/);
    expect(clientSource).toMatch(/Chưa kết nối/);
    expect(clientSource).toMatch(/Thiếu email/);
    expect(clientSource).toMatch(/Đã gửi lời mời/);
    expect(clientSource).toMatch(/Chờ đặt mật khẩu/);
    expect(clientSource).toMatch(/Đã kết nối/);
    expect(clientSource).toMatch(/Lời mời lỗi/);
    expect(clientSource).toMatch(/Lời mời hết hạn/);
    expect(clientSource).toMatch(/Đã thu hồi quyền/);
    expect(clientSource).toMatch(/Lỗi liên kết/);
    expect(clientSource).toMatch(/Gửi lời mời/);
    expect(clientSource).toMatch(/Cập nhật email/);
    expect(clientSource).toMatch(/Gửi lại lời mời/);
    expect(clientSource).toMatch(/Gửi link đặt lại mật khẩu/);
  });

  it('gates employee mutations and account actions with separate permissions', () => {
    const actionSource = source('services/server/adminEmployeeActions.ts');
    const inviteRoute = source('app/api/admin/employees/[id]/invite/route.ts');
    const resetRoute = source('app/api/admin/employees/[id]/send-password-reset/route.ts');
    const revokeRoute = source('app/api/admin/employees/[id]/revoke-access/route.ts');
    const restoreRoute = source('app/api/admin/employees/[id]/restore-access/route.ts');

    expect(actionSource).toMatch(/requireAdminEmployeePermission\('EMPLOYEE_MANAGE'\)/);
    expect(actionSource).toMatch(/requireAdminEmployeePermission\('ACCOUNT_MANAGE'\)/);
    expect(inviteRoute).toMatch(/inviteEmployee/);
    expect(resetRoute).toMatch(/sendEmployeePasswordReset/);
    expect(revokeRoute).toMatch(/revokeEmployeeAccess/);
    expect(restoreRoute).toMatch(/restoreEmployeeAccess/);
  });

  it('does not trust client-submitted email or auth IDs for account actions', () => {
    const actionSource = source('services/server/adminEmployeeActions.ts');
    const inviteRoute = source('app/api/admin/employees/[id]/invite/route.ts');
    const resetRoute = source('app/api/admin/employees/[id]/send-password-reset/route.ts');

    expect(actionSource).toMatch(/loadTargetEmployee/);
    expect(actionSource).toMatch(/ensureNoDuplicateEmployeeEmail/);
    expect(actionSource).toMatch(/ensureAuthEmailIsUnmapped/);
    expect(actionSource).toMatch(/mappedToOtherEmployee/);
    expect(inviteRoute).not.toMatch(/request\.json/);
    expect(resetRoute).not.toMatch(/request\.json/);
  });

  it('keeps invite and password recovery as separate flows', () => {
    const actionSource = source('services/server/adminEmployeeActions.ts');
    const inviteStart = actionSource.indexOf('export async function inviteEmployee');
    const resendStart = actionSource.indexOf('export async function resendEmployeeInvite');
    const resetStart = actionSource.indexOf('export async function sendEmployeePasswordReset');
    const inviteBody = actionSource.slice(inviteStart, resendStart);
    const resetBody = actionSource.slice(resetStart);

    expect(inviteBody).toMatch(/inviteUserByEmail/);
    expect(inviteBody).not.toMatch(/resetPasswordForEmail/);
    expect(resetBody).toMatch(/resetPasswordForEmail/);
  });

  it('keeps Supabase admin secrets server-only and out of the employee client bundle source', () => {
    const adminClient = source('utils/supabase/admin.ts');
    const clientSource = source('app/admin/employees/AdminEmployeesClient.tsx');

    expect(adminClient).toMatch(/import 'server-only'/);
    expect(adminClient).toMatch(/SUPABASE_SECRET_KEY/);
    expect(adminClient).not.toMatch(/NEXT_PUBLIC_.*SECRET|NEXT_PUBLIC_.*SERVICE_ROLE/);
    expect(clientSource).not.toMatch(/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|utils\/supabase\/admin/);
  });

  it('creates a draft RLS policy, rollback, and validation for employee admin SELECT', () => {
    const migrationPath = 'supabase/migrations/20260715030000_rls_employee_admin_view_select.sql';
    const rollbackPath = 'supabase/rollbacks/20260715030000_rls_employee_admin_view_select_rollback.sql';
    const validationPath = 'supabase/validation/20260715030000_rls_employee_admin_view_select_validation.sql';

    expect(existsSync(join(repositoryRoot, migrationPath))).toBe(true);
    expect(existsSync(join(repositoryRoot, rollbackPath))).toBe(true);
    expect(existsSync(join(repositoryRoot, validationPath))).toBe(true);

    const migration = source(migrationPath);
    expect(migration).toMatch(/for select/);
    expect(migration).toMatch(/has_workspace_access\('ADMIN_WORKSPACE'\)/);
    expect(migration).toMatch(/has_permission\('EMPLOYEE_VIEW'\)/);
    expect(migration).not.toMatch(/for all|for insert|for update|for delete/i);
  });

  it('does not silently turn employee list query errors into partial lists', () => {
    const serviceSource = source('services/server/adminEmployeeData.ts');
    const errorBlockStart = serviceSource.indexOf('if (employeeError)');
    const errorBlockEnd = serviceSource.indexOf('const authUsersById', errorBlockStart);
    const errorBlock = serviceSource.slice(errorBlockStart, errorBlockEnd);

    expect(serviceSource).toMatch(/if \(employeeError\)/);
    expect(errorBlock).toMatch(/throw new AuthFlowError/);
    expect(errorBlock).not.toMatch(/return\s+\{/);
  });
});
