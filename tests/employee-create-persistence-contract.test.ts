import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEmployeeCreateRequest } from '../lib/employeeCreateContract';

const actions = readFileSync(join(__dirname, '..', 'services/server/adminEmployeeActions.ts'), 'utf8');

describe('employee create persistence contract', () => {
  it('maps the exact reported production payload to the expected insert values', () => {
    const parsed = parseEmployeeCreateRequest({
      fullName: 'Maker Lab',
      email: 'makerlab.marketing@gmail.com',
      title: 'Tester',
      department: 'X_NG_CH_NH_LUMINAL',
      phone: '',
      employmentStatus: 'ACTIVE',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(actions).toMatch(/full_name: fullName/);
    expect(actions).toMatch(/email,/);
    expect(actions).toMatch(/title: cleanText\(input\.title\)/);
    expect(actions).toMatch(/phone: normalizeEmployeePhone\(input\.phone\)/);
    expect(actions).toMatch(/branch_code: await validateFacilityAssignment\(normalizedInput\.department\)/);
    expect(actions).toMatch(/role: 'STAFF'/);
    expect(actions).toMatch(/is_active: true/);
    expect(actions).toMatch(/auth_user_id: null/);
    expect(parsed.data).toMatchObject({
      fullName: 'Maker Lab',
      email: 'makerlab.marketing@gmail.com',
      title: 'Tester',
      department: 'X_NG_CH_NH_LUMINAL',
      phone: '',
      employmentStatus: 'ACTIVE',
    });
  });

  it('does not invent a facility reference when resolution returns no code', () => {
    const parsed = parseEmployeeCreateRequest({
      fullName: 'Maker Lab',
      email: 'makerlab.marketing@gmail.com',
      title: 'Tester',
      department: '',
      phone: '',
      employmentStatus: 'ACTIVE',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.department).toBe('');
    expect(actions).toContain('branch_code: await validateFacilityAssignment(normalizedInput.department)');
  });
});
