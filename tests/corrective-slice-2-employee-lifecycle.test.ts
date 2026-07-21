import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

function source(path: string) {
  return fs.readFileSync(path, 'utf8');
}

describe('corrective slice 2 employee profile and account lifecycle', () => {
  it('creates employee profiles without Auth invitation and waits for persistence', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const createStart = actions.indexOf('export async function createEmployee');
    const updateStart = actions.indexOf('export async function updateEmployee', createStart);
    const createBody = actions.slice(createStart, updateStart);

    expect(createBody).toMatch(/requireAdminEmployeePermission\('EMPLOYEE_MANAGE'\)/);
    expect(createBody).toMatch(/auth_user_id: null/);
    expect(createBody).toMatch(/from\('employees'\)\.insert\(\[payload\]\)\.select\('id, auth_user_id'\)\.single\(\)/);
    expect(createBody).toMatch(/employee_created_without_auth/);
    expect(createBody).not.toMatch(/inviteUserByEmail|resetPasswordForEmail|employee_workspace_access|employee_permissions/);
  });

  it('validates required fields, status and duplicate employee email with stable safe errors', () => {
    const actions = source('services/server/adminEmployeeActions.ts');

    expect(actions).toMatch(/employee_full_name_required/);
    expect(actions).toMatch(/employee_email_required/);
    expect(actions).toMatch(/employee_email_invalid/);
    expect(actions).toMatch(/employee_status_invalid/);
    expect(actions).toMatch(/employee_email_duplicate_active/);
    expect(actions).toMatch(/employee_email_soft_deleted_duplicate/);
    expect(actions).toMatch(/employee_persistence_failed/);
    expect(actions).toMatch(/'validation'/);
    expect(actions).toMatch(/'persistence'/);
  });

  it('keeps job title optional and keeps quick edit away from salary, bank and permissions', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const buildStart = actions.indexOf('function buildEmployeePayload');
    const buildEnd = actions.indexOf('function isActiveEmployee', buildStart);
    const buildBody = actions.slice(buildStart, buildEnd);
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');

    expect(buildBody).toMatch(/title: cleanText\(input\.title\)/);
    expect(buildBody).not.toMatch(/title: cleanText\(input\.title\) \|\| 'Nhân sự'/);
    expect(`${listClient}${detailClient}`).toMatch(/Sửa nhanh/);
    expect(`${listClient}${detailClient}`).toMatch(/Điện thoại/);
    expect(`${listClient}${detailClient}`).toMatch(/Bộ phận/);
    expect(`${listClient}${detailClient}`).not.toMatch(/bankAccount|bank_account|salary|baseSalary|permissions:/);
  });

  it('separates invitation, retry and password reset from profile creation', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const inviteStart = actions.indexOf('export async function inviteEmployee');
    const resendStart = actions.indexOf('export async function resendEmployeeInvite', inviteStart);
    const resetStart = actions.indexOf('export async function sendEmployeePasswordReset', resendStart);
    const inviteBody = actions.slice(inviteStart, resendStart);
    const resetBody = actions.slice(resetStart, actions.indexOf('export async function revokeEmployeeAccess', resetStart));

    expect(actions).toMatch(/requireAdminEmployeePermission\('ACCOUNT_MANAGE'\)/);
    expect(inviteBody).toMatch(/inviteUserByEmail/);
    expect(inviteBody).toMatch(/employee_invitation_failed/);
    expect(inviteBody).toMatch(/failureStage: 'invitation_send'/);
    expect(inviteBody).toMatch(/findUnmappedAuthUserIdForEmployeeEmail/);
    expect(inviteBody).not.toMatch(/employee_workspace_access|employee_permissions/);
    expect(resetBody).toMatch(/resetPasswordForEmail/);
    expect(resetBody).not.toMatch(/inviteUserByEmail/);
  });

  it('returns sanitized route error codes and refreshes employee UI after persistence', () => {
    const createRoute = source('app/api/admin/employees/route.ts');
    const updateRoute = source('app/api/admin/employees/[id]/route.ts');
    const client = source('app/admin/employees/AdminEmployeesClient.tsx');

    expect(`${createRoute}${updateRoute}`).toMatch(/code: error\.code/);
    expect(`${createRoute}${updateRoute}`).toMatch(/failureStage: error\.failureStage/);
    expect(`${createRoute}${updateRoute}`).toMatch(/employee_unhandled_failure/);
    expect(`${createRoute}${updateRoute}`).not.toMatch(/JSON\.stringify\(error\)|supabase|postgres|PostgreSQL/);
    expect(client).toMatch(/Mời sử dụng hệ thống/);
    expect(client).toMatch(/Chưa kết nối/);
    expect(client).toMatch(/refreshPage\(\)/);
    expect(client).toMatch(/savingEmployee/);
    expect(client).toMatch(/activeActionKey/);
  });
});
