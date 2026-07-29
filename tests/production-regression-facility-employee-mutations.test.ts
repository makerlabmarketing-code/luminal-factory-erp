import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('production regression facility and employee mutations', () => {
  it('keeps facility mutations server-mediated after app authorization', () => {
    const service = source('services/server/adminFacilities.ts');
    const createStart = service.indexOf('export async function createAdminFacility');
    const updateStart = service.indexOf('export async function updateAdminFacility');
    const deleteStart = service.indexOf('export async function deleteAdminFacility');
    const createBody = service.slice(createStart, updateStart);
    const updateBody = service.slice(updateStart, deleteStart);

    expect(service).toMatch(/requireFacilityManage/);
    expect(service).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'SYSTEM_SETTINGS_MANAGE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'ATTENDANCE_MANAGE'\)/);
    expect(createBody).toMatch(/const supabase = createSupabaseAdminClient\(\)/);
    expect(createBody).toMatch(/code: await createUniqueFacilityCode\(parsedPayload\.facility_name\)/);
    expect(createBody).toMatch(/is_active: true/);
    expect(updateBody).toMatch(/const supabase = createSupabaseAdminClient\(\)/);
    expect(`${createBody}${updateBody}`).not.toMatch(/await createClient\(\)/);
    expect(`${createBody}${updateBody}`).not.toMatch(/employee|attendance|CN1/);
  });

  it('does not add broad browser facility write authorization', () => {
    const service = source('services/server/adminFacilities.ts');
    const client = source('app/admin/facilities/page.tsx');

    expect(client).toMatch(/fetch\('\/api\/admin\/facilities'/);
    expect(client).not.toMatch(/from\('facilities'\)\.(insert|update|delete|upsert)/);
    expect(service).toMatch(/createSupabaseAdminClient/);
    expect(service).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });

  it('distinguishes facility authorization failures from persistence failures', () => {
    const service = source('services/server/adminFacilities.ts');
    const route = source('app/api/admin/facilities/route.ts');
    const mutationStart = service.indexOf('export async function createAdminFacility');
    const mutationBody = service.slice(mutationStart);

    expect(mutationBody).toMatch(/facility_persistence_failed/);
    expect(mutationBody).not.toMatch(/code: 'admin_verification_failed'/);
    expect(route).toMatch(/logFacilityRouteError/);
    expect(route).toMatch(/correlationId/);
    expect(route).toMatch(/error\.status === 403 \? 'facility_forbidden' : error\.code/);
  });

  it('keeps employee phone optional and facility assignment canonical', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const buildStart = actions.indexOf('function buildEmployeePayload');
    const buildEnd = actions.indexOf('async function validateFacilityAssignment', buildStart);
    const validateEnd = actions.indexOf('function isActiveEmployee', buildEnd);
    const buildBody = actions.slice(buildStart, buildEnd);
    const validateBody = actions.slice(buildEnd, validateEnd);

    expect(buildBody).toMatch(/phone: normalizeEmployeePhone\(input\.phone\)/);
    expect(buildBody).toMatch(/title: cleanText\(input\.title\)/);
    expect(buildBody).toMatch(/branch_code: cleanText\(input\.department, 80\)/);
    expect(validateBody).toMatch(/if \(currentValue && requestedCode === currentValue\) return currentValue/);
    expect(validateBody).toMatch(/return facility\.code/);
    expect(actions).toMatch(/const normalizedPhone = phone\.replace\(\/\[\\s\.\(\)-\]\/g, ''\)/);
    expect(actions).toMatch(/employee_phone_invalid/);
  });

  it('maps employee unknown failures to a stable sanitized code with correlation', () => {
    const createRoute = source('app/api/admin/employees/route.ts');
    const updateRoute = source('app/api/admin/employees/[id]/route.ts');

    expect(`${createRoute}${updateRoute}`).toMatch(/logEmployeeRouteError/);
    expect(`${createRoute}${updateRoute}`).toMatch(/employee_update_failed/);
    expect(`${createRoute}${updateRoute}`).toMatch(/correlationId/);
    expect(`${createRoute}${updateRoute}`).not.toMatch(/employee_unhandled_failure/);
    expect(`${createRoute}${updateRoute}`).not.toMatch(/JSON\.stringify\(error\)|postgres|PostgreSQL/);
    expect(updateRoute).not.toMatch(/error\.message\.slice|String\(error\)/);
    expect(updateRoute).toMatch(/failureStage: result\.failureStage \|\| 'persisted'/);
  });

  it('keeps failed saves open with toast, inline error and double-submit protection', () => {
    const facilitiesClient = source('app/admin/facilities/page.tsx');
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');

    expect(facilitiesClient).toMatch(/if \(isSaving\) return/);
    expect(facilitiesClient).toMatch(/setSaveError\(message\)/);
    expect(facilitiesClient).toMatch(/showToast\('Không thể lưu', 'Không thể lưu cơ sở làm việc\. Vui lòng thử lại\.', 'error'\)/);
    expect(facilitiesClient).toMatch(/showToast\('Đã lưu', 'Đã lưu cơ sở làm việc\.', 'success'\)/);
    expect(facilitiesClient).toMatch(/finally\s*\{\s*setIsSaving\(false\)/);

    for (const client of [listClient, detailClient]) {
      expect(client).toMatch(/setFormError\(message\)/);
      expect(client).toContain('Không thể kết nối để cập nhật hồ sơ nhân sự. Vui lòng thử lại.');
      expect(client).toMatch(/showToast\('Không thể cập nhật', message, 'error'\)/);
      expect(client).toMatch(/showToast\('Đã cập nhật', 'Đã cập nhật hồ sơ nhân sự\.', 'success'\)/);
      expect(client).toMatch(/if \(!formState \|\| savingEmployee\) return/);
      expect(client).toMatch(/finally\s*\{\s*setSavingEmployee\(false\)/);
      expect(client).toMatch(/role="alert"/);
    }
  });

  it('keeps quick edit on the employee detail route and makes modals internally scrollable', () => {
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
    const facilitiesClient = source('app/admin/facilities/page.tsx');

    expect(listClient).toMatch(/href=\{`\/admin\/employees\/\$\{employee\.employeeId\}`\}/);
    expect(listClient).not.toMatch(/openEditForm\(employee\)/);
    expect(detailClient).toMatch(/onClick=\{openQuickEdit\}/);
    expect(detailClient).toMatch(/router\.refresh\(\)/);
    expect(detailClient).not.toMatch(/router\.push\(['"]\/admin\/employees['"]\)/);

    for (const client of [facilitiesClient, listClient, detailClient]) {
      expect(client).toMatch(/max-h-\[calc\(100vh-2rem\)\]/);
      expect(client).toMatch(/overflow-y-auto/);
      expect(client).toMatch(/document\.body\.style\.overflow = 'hidden'/);
    }
  });

  it('does not mutate unrelated business rows during core updates', () => {
    const facilities = source('services/server/adminFacilities.ts');
    const employeeActions = source('services/server/adminEmployeeActions.ts');
    const createStart = facilities.indexOf('export async function createAdminFacility');
    const facilityMutations = facilities.slice(createStart);
    const updateStart = employeeActions.indexOf('export async function updateEmployee');
    const deactivateStart = employeeActions.indexOf('export async function deactivateEmployee', updateStart);
    const updateEmployeeBody = employeeActions.slice(updateStart, deactivateStart);

    expect(facilityMutations).toMatch(/from\('facilities'\)/);
    expect(facilityMutations).not.toMatch(/from\('employees'\)|from\('attendance'|from\('employee_workspace_access'|from\('employee_permissions'/);
    expect(updateEmployeeBody).toMatch(/from\('employees'\)\.update\(payload\)\.eq\('id', employeeId\)/);
    expect(updateEmployeeBody).not.toMatch(/from\('attendance'|from\('employee_workspace_access'|from\('employee_permissions'|from\('facilities'\)/);
    expect(updateEmployeeBody).not.toMatch(/getAdminEmployee|getEmployeeDetail|loadFacilityDirectory|listAuthUsers/);
  });

  it('keeps employee failures in the editor and exposes the sanitized correlation reference', () => {
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');

    for (const client of [listClient, detailClient]) {
      expect(client).toMatch(/result\.correlationId \? ` Mã tra cứu: \$\{result\.correlationId\}\.` : ''/);
      expect(client).toMatch(/setFormError\(message\)/);
      expect(client.indexOf('setFormState(null)')).toBeGreaterThan(client.indexOf("if (!result.success)"));
      expect(client).toMatch(/refreshPage\(\)/);
      expect(client).not.toMatch(/window\.location\.reload/);
    }
  });
});
