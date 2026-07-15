import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_PRESETS,
  ALL_PERMISSION_CODES,
  PERMISSION_GROUPS,
} from '../lib/account-permissions';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('account and permission management slice', () => {
  it('serves the accounts page through a server DTO and ACCOUNT_MANAGE gate', () => {
    const page = source('app/admin/accounts/page.tsx');
    const client = source('app/admin/accounts/AdminAccountsClient.tsx');
    const service = source('services/server/adminAccountManagement.ts');

    expect(page).not.toMatch(/['"]use client['"]/);
    expect(page).toMatch(/getAdminAccountManagementData/);
    expect(client).toMatch(/Quản lý tài khoản & phân quyền/);
    expect(client).not.toMatch(/from\(['"]employee_permissions['"]\)|from\(['"]employee_workspace_access['"]\)|utils\/supabase\/admin|SUPABASE_SECRET_KEY/);
    expect(service).toMatch(/requireAdminEmployeePermission\('ACCOUNT_MANAGE'\)/);
    expect(service).toMatch(/createSupabaseAdminClient/);
  });

  it('defines the requested permission presets in application code', () => {
    const administrator = ACCOUNT_PRESETS.find((preset) => preset.code === 'ADMINISTRATOR');
    const staff = ACCOUNT_PRESETS.find((preset) => preset.code === 'STAFF');

    expect(administrator?.workspaces).toEqual(['STAFF_WORKSPACE', 'ADMIN_WORKSPACE']);
    expect(administrator?.permissions).toEqual(ALL_PERMISSION_CODES);
    expect(staff?.workspaces).toEqual(['STAFF_WORKSPACE']);
    expect(staff?.permissions).toEqual([]);
    expect(ACCOUNT_PRESETS.map((preset) => preset.code)).toEqual([
      'ADMINISTRATOR',
      'HR_MANAGER',
      'PROJECT_MANAGER',
      'CREATIVE_LEAD',
      'OPERATIONS',
      'STAFF',
    ]);
  });

  it('groups permissions for the editor', () => {
    expect(PERMISSION_GROUPS.map((group) => group.label)).toEqual([
      'Nhân sự',
      'Tài chính',
      'Dự án',
      'Chấm công',
      'Hệ thống',
    ]);
  });

  it('implements the requested account API contract', () => {
    const listRoute = source('app/api/admin/accounts/route.ts');
    const detailRoute = source('app/api/admin/accounts/[employeeId]/route.ts');
    const workspaceRoute = source('app/api/admin/accounts/[employeeId]/workspaces/route.ts');
    const permissionRoute = source('app/api/admin/accounts/[employeeId]/permissions/route.ts');
    const presetRoute = source('app/api/admin/accounts/[employeeId]/apply-preset/route.ts');
    const revokeRoute = source('app/api/admin/accounts/[employeeId]/revoke-access/route.ts');

    expect(listRoute).toMatch(/getAdminAccountManagementData/);
    expect(detailRoute).toMatch(/getAdminAccountDetailData/);
    expect(workspaceRoute).toMatch(/updateAccountWorkspaces/);
    expect(permissionRoute).toMatch(/updateAccountPermissions/);
    expect(presetRoute).toMatch(/applyAccountPreset/);
    expect(revokeRoute).toMatch(/revokeAccountAccess/);
    expect(`${workspaceRoute}${permissionRoute}${presetRoute}${revokeRoute}`).not.toMatch(/actor|role|is_admin/);
  });

  it('keeps account mutation safety guards in the server service', () => {
    const service = source('services/server/adminAccountManagement.ts');

    expect(service).toMatch(/assertNotRemovingLastAdministrator/);
    expect(service).toMatch(/Không thể xóa quản trị viên cuối cùng/);
    expect(service).toMatch(/permissionStateFor/);
    expect(service).toMatch(/effect === 'DENY'/);
    expect(service).toMatch(/effect === 'ALLOW'/);
    expect(service).toMatch(/granted_by_employee_id/);
    expect(service).toMatch(/revoked_at/);
    expect(service).not.toMatch(/delete\(\)/);
  });

  it('does not expose privileged credentials or browser Supabase mutations', () => {
    const client = source('app/admin/accounts/AdminAccountsClient.tsx');
    const adminClient = source('utils/supabase/admin.ts');

    expect(adminClient).toMatch(/import 'server-only'/);
    expect(client).not.toMatch(/SUPABASE_SECRET_KEY|createSupabaseAdminClient|createBrowserClient|\.from\(/);
  });
});
