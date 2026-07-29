import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('production employee persistence incident contract', () => {
  const admin = source('services/server/adminEmployeeActions.ts');
  const adminRoute = source('app/api/admin/employees/[id]/route.ts');
  const staffRoute = source('app/api/staff/profile/route.ts');
  const staffService = source('services/staffProfileService.ts');
  const staffView = source('app/staff/profile/ProfileView.tsx');
  const auth = source('services/server/auth.ts');
  const adminClient = source('utils/supabase/admin.ts');

  it('patches only supplied admin fields and preserves title, status, and facility on a phone-only update', () => {
    expect(admin).toContain("hasOwnProperty.call(input, 'phone')");
    expect(admin).toContain('payload.phone = normalizeEmployeePhone(input.phone)');
    expect(admin).toContain("hasOwnProperty.call(input, 'title')");
    expect(admin).toContain("hasOwnProperty.call(input, 'employmentStatus')");
    expect(admin).toContain("hasOwnProperty.call(input, 'department')");
  });

  it('persists canonical facility codes and never writes the department field', () => {
    expect(admin).toContain('payload.branch_code = await validateFacilityAssignment');
    expect(admin).toContain('return facility.code');
    expect(admin).not.toMatch(/payload\.department\s*=/);
  });

  it('keeps successful admin mutation successful when readback fails', () => {
    const update = admin.slice(admin.indexOf('export async function updateEmployee'), admin.indexOf('export async function deactivateEmployee'));
    expect(update.indexOf(".update(payload).eq('id', employeeId)")).toBeLessThan(update.indexOf(".select('id, full_name"));
    expect(update).toContain("warnings: readbackError || !persisted ? ['employee_readback_failed'] : []");
    expect(update).toContain('{ ...targetEmployee, ...payload }');
  });

  it('resolves staff identity through auth_user_id and targets only that employee id', () => {
    expect(auth).toContain(".eq('auth_user_id', user.id)");
    expect(staffRoute).toContain(".eq('id', authContext.employee.id)");
    expect(staffRoute).not.toMatch(/\.from\(['"]profiles['"]\)/);
  });

  it('persists staff phone and bank fields in employees and reads them back from the same row', () => {
    expect(staffRoute).toContain("payload.phone = cleanProfileField(body.phone)");
    expect(staffRoute).toContain('payload.bank_name = cleanProfileField(body.bankName)');
    expect(staffRoute).toContain('payload.bank_account_number = cleanProfileField(body.bankAccountNumber)');
    expect(staffRoute).toContain(".select('phone, bank_name, bank_account_number')");
    expect(staffService).toContain('return result.employee');
  });

  it('rejects forbidden staff fields', () => {
    expect(staffRoute).toContain("new Set(['phone', 'bankName', 'bankAccountNumber'])");
    expect(staffRoute).toContain("status: 403");
  });

  it('does not erase profile data when optional facility enrichment is unavailable', () => {
    expect(staffView).toContain('worker.branch_code || worker.branch');
    expect(staffView).toContain('setWorker((current) => current ? { ...current, ...saved } : current)');
  });

  it('uses employees as the single admin and staff source of truth', () => {
    expect(admin).toContain(".from('employees')");
    expect(staffRoute).toContain(".from('employees')");
    expect(`${admin}${staffRoute}`).not.toMatch(/\.from\(['"]profiles['"]\)/);
  });

  it('returns correlation and known stages for database and boundary failures', () => {
    expect(adminRoute).toContain('correlationId');
    expect(staffRoute).toContain("failureStage: 'core_mutation'");
    expect(staffRoute).toContain("failureStage: 'request_boundary'");
    expect(staffRoute).not.toContain("failureStage: 'unknown'");
  });

  it('does not mutate unrelated employee rows and invalidates staff caches after success', () => {
    expect(staffRoute.match(/\.eq\('id', authContext\.employee\.id\)/g)).toHaveLength(2);
    expect(staffRoute).toContain("revalidatePath('/staff')");
    expect(staffRoute).toContain("revalidatePath('/staff/profile')");
  });

  it('supports both server-only Supabase privileged key names', () => {
    expect(adminClient).toContain('process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY');
    expect(adminClient).toContain("import 'server-only'");
  });
});
