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
    expect(actions).toMatch(/buildEmployeeUpdatePayload/);
    expect(actions).toMatch(/Object\.prototype\.hasOwnProperty\.call\(input, 'phone'\)/);
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
    expect(updateRoute).not.toMatch(/failureStage: 'unknown'/);
  });

  it('keeps employee create failures diagnosable without exposing database messages', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const route = source('app/api/admin/employees/route.ts');
    const createStart = actions.indexOf('export async function createEmployee');
    const createBody = actions.slice(createStart);

    expect(route).toMatch(/const correlationId = crypto\.randomUUID\(\)/);
    expect(route).toMatch(/createEmployee\(body, correlationId\)/);
    expect(route).toMatch(/sanitizeAdminMutationFailure/);
    expect(route).not.toMatch(/error\.message\.slice|String\(error\)/);
    expect(actions).toMatch(/employee_email_duplicate_active/);
    expect(actions).toMatch(/employee_persistence_unavailable/);
    expect(actions).toMatch(/employee_created_after_uncertain_result/);
    expect(actions).toMatch(/readEmployeeByEmail/);
    expect(actions).toMatch(/employee_create_response_uncertain/);
    expect(createBody).toMatch(/employee: result\.data/);
  });

  it('normalizes optional create fields and prevents repeated submissions synchronously', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const client = source('app/admin/employees/AdminEmployeesClient.tsx');

    expect(actions).toMatch(/phone: normalizeEmployeePhone\(input\.phone\)/);
    expect(actions).toMatch(/title: cleanText\(input\.title\)/);
    expect(actions).toMatch(/branch_code: await validateFacilityAssignment\(normalizedInput\.department\)/);
    expect(client).toMatch(/const savingEmployeeRef = useRef\(false\)/);
    expect(client).toMatch(/savingEmployeeRef\.current\) return/);
    expect(client).toMatch(/savingEmployeeRef\.current = true/);
    expect(client).toMatch(/savingEmployeeRef\.current = false/);
  });

  it('keeps the exact create payload contract aligned with the LuminalQA reproduction shape', () => {
    const client = source('app/admin/employees/AdminEmployeesClient.tsx');
    const actions = source('services/server/adminEmployeeActions.ts');
    const route = source('app/api/admin/employees/route.ts');

    expect(client).toMatch(/fullName: ''/);
    expect(client).toMatch(/email: ''/);
    expect(client).toMatch(/title: ''/);
    expect(client).toMatch(/department: ''/);
    expect(client).toMatch(/phone: ''/);
    expect(client).toMatch(/employmentStatus: 'ACTIVE'/);
    expect(client).toMatch(/body: JSON\.stringify\(formState\)/);
    expect(client).toMatch(/value=\{facility\.code\}/);
    expect(actions).toMatch(/validateEmployeeCreateShape\(input\)/);
    expect(actions).toMatch(/return email\.toLowerCase\(\)/);
    expect(route).toMatch(/fieldErrors: error\.fieldErrors/);
    expect(client).toMatch(/formFieldErrors/);
    expect(client).toMatch(/aria-invalid=\{Boolean\(formFieldErrors\./);
    expect(client).toMatch(/requestAnimationFrame/);
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

    for (const client of [detailClient]) {
      expect(client).toMatch(/setError\(message\)/);
      expect(client).toMatch(/showToast\('Không thể cập nhật'/);
      expect(client).toMatch(/showToast\('Đã cập nhật', 'Đã cập nhật thông tin nhân sự\.', 'success'\)/);
      expect(client).toMatch(/if \(!dirty \|\| savingRef\.current\) return/);
      expect(client).toMatch(/finally \{ savingRef\.current = false; setSaving\(false\); \}/);
      expect(client).toMatch(/role="alert"/);
    }
    expect(listClient).not.toContain("method: 'PATCH'");
  });

  it('consolidates editing on the employee detail route', () => {
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
    const facilitiesClient = source('app/admin/facilities/page.tsx');

    expect(listClient).toMatch(/href=\{`\/admin\/employees\/\$\{employee\.employeeId\}`\}/);
    expect(listClient).not.toMatch(/openEditForm\(employee\)/);
    expect(listClient).not.toMatch(/Sửa nhanh/);
    expect(detailClient).toMatch(/Lưu thay đổi/);
    expect(detailClient).toMatch(/router\.refresh\(\)/);
    expect(detailClient).not.toMatch(/router\.push\(['"]\/admin\/employees['"]\)/);

    for (const client of [facilitiesClient, listClient]) {
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
    expect(updateEmployeeBody).toMatch(/persistAdminEmployee\(supabaseAdmin, employeeId, payload, trace\)/);
    expect(updateEmployeeBody).not.toMatch(/from\('attendance'|from\('employee_workspace_access'|from\('employee_permissions'|from\('facilities'\)/);
    expect(updateEmployeeBody).not.toMatch(/getAdminEmployee|getEmployeeDetail|loadFacilityDirectory|listAuthUsers/);
  });

  it('keeps employee failures in the editor and exposes the sanitized correlation reference', () => {
    const listClient = source('app/admin/employees/AdminEmployeesClient.tsx');
    const detailClient = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');

    for (const client of [detailClient]) {
      expect(client).toMatch(/result\.correlationId \? ` Mã tra cứu: \$\{result\.correlationId\}\.` : ''/);
      expect(client).toMatch(/setError\(message\)/);
      expect(client).toMatch(/router\.refresh\(\)/);
      expect(client).not.toMatch(/window\.location\.reload/);
    }
  });
});
