import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  MAX_EMPLOYEE_HOURLY_RATE,
  validateEmployeeHourlyRate,
} from '../lib/employeeHourlyRate';
import { calculateSalary } from '../services/payrollService';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Admin employee hourly-rate administration', () => {
  it('accepts zero and supported two-decimal values', () => {
    expect(validateEmployeeHourlyRate('0')).toEqual({ ok: true, value: 0 });
    expect(validateEmployeeHourlyRate(0)).toEqual({ ok: true, value: 0 });
    expect(validateEmployeeHourlyRate('30000.25')).toEqual({ ok: true, value: 30000.25 });
    expect(validateEmployeeHourlyRate(String(MAX_EMPLOYEE_HOURLY_RATE))).toEqual({
      ok: true,
      value: MAX_EMPLOYEE_HOURLY_RATE,
    });
  });

  it.each(['', 'abc', '-1', '1.001', 'NaN', 'Infinity'])('rejects invalid rate %s', (value) => {
    expect(validateEmployeeHourlyRate(value).ok).toBe(false);
  });

  it('rejects values beyond the existing numeric(14,2) storage boundary', () => {
    expect(validateEmployeeHourlyRate('1000000000000').ok).toBe(false);
  });

  it('keeps the update behind Employee Manage and Finance View permissions', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const updateStart = actions.indexOf('export async function updateEmployee');
    const updateEnd = actions.indexOf('export async function deactivateEmployee', updateStart);
    const updateBody = actions.slice(updateStart, updateEnd);

    expect(updateBody).toMatch(/requireAdminEmployeePermission\('EMPLOYEE_MANAGE'\)/);
    expect(updateBody).toMatch(/hasOwnProperty\.call\(input, 'hourlyRate'\)/);
    expect(updateBody).toMatch(/hasPermission\(actor, 'FINANCE_VIEW'\)/);
    expect(updateBody).toMatch(/persistAdminEmployee\(supabaseAdmin, employeeId, payload, trace\)/);
    expect(updateBody).not.toMatch(/from\('attendance'|from\('payroll_|settle_monthly_payroll/);
  });

  it('updates only the submitted compensation field and preserves unrelated employee data', () => {
    const actions = source('services/server/adminEmployeeActions.ts');
    const persistence = source('services/server/adminEmployeePersistence.ts');

    expect(actions).toMatch(/hasOwnProperty\.call\(input, 'hourlyRate'\)[\s\S]*payload\.hourly_rate = hourlyRate\.value/);
    expect(persistence).toMatch(/\.from\('employees'\)\.update\(payload\)\.eq\('id', employeeId\)/);
    expect(persistence).toContain('hourly_rate: number');
    expect(persistence).toContain('bank_account_number, hourly_rate');
  });

  it('provides client and server validation while preserving failed form state', () => {
    const client = source('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
    const actions = source('services/server/adminEmployeeActions.ts');

    expect(client).toContain("finance: ['bankName', 'bankAccountNumber', 'hourlyRate']");
    expect(client).toMatch(/validateEmployeeHourlyRate\(draft\.hourlyRate\)/);
    expect(client).toMatch(/setHourlyRateError\(hourlyRate\.message\)/);
    expect(client).toMatch(/type="number"[\s\S]*min="0"[\s\S]*step="0\.01"/);
    expect(client).toMatch(/if \(!dirty \|\| savingRef\.current\) return/);
    expect(client).toMatch(/savingRef\.current = true/);
    expect(client).toMatch(/finally \{ savingRef\.current = false; setSaving\(false\); \}/);
    expect(client).toMatch(/<form noValidate onSubmit=\{save\}/);
    expect(client).toMatch(/startTransition\(\(\) => router\.refresh\(\)\)/);
    expect(client).toMatch(/dirtyFields\.includes\('hourlyRate'\) \? Number\(draft\.hourlyRate\) : current\.hourlyRate/);
    expect(actions).toMatch(/validateEmployeeHourlyRate\(input\.hourlyRate\)/);
  });

  it('keeps payroll calculation unchanged and produces zero salary for a zero rate', () => {
    expect(calculateSalary(8, 0)).toBe(0);
    expect(calculateSalary(8, 30000)).toBe(240000);
  });
});
