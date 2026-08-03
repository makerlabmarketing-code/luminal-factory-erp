import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEmployeeCreateRequest } from '../lib/employeeCreateContract';
import { generateEmployeeQrToken } from '../services/server/employeeQrToken';

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
    expect(actions).toMatch(/const title = cleanText\(input\.title\)/);
    expect(actions).toMatch(/title,/);
    expect(actions).toMatch(/phone: normalizeEmployeePhone\(input\.phone\)/);
    expect(actions).toMatch(/branch_code: await validateFacilityAssignment\(normalizedInput\.department\)/);
    expect(actions).toMatch(/role: 'STAFF'/);
    expect(actions).toMatch(/is_active: true/);
    expect(actions).toMatch(/auth_user_id: null/);
    expect(actions).toMatch(/qr_token: generateEmployeeQrToken\(\)/);
    expect(parsed.data).toMatchObject({
      fullName: 'Maker Lab',
      email: 'makerlab.marketing@gmail.com',
      title: 'Tester',
      department: 'X_NG_CH_NH_LUMINAL',
      phone: '',
      employmentStatus: 'ACTIVE',
    });
  });

  it('generates distinct UUID v4 Employee QR tokens only at the authorized server insert boundary', () => {
    const first = generateEmployeeQrToken();
    const second = generateEmployeeQrToken();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(second).not.toBe(first);
    expect(actions.indexOf("requireAdminEmployeePermission('EMPLOYEE_MANAGE')"))
      .toBeLessThan(actions.indexOf('generateEmployeeQrToken()'));
  });

  it('bounds retries to QR-token uniqueness collisions without retrying the whole request', () => {
    expect(actions).toContain('attempt < EMPLOYEE_QR_TOKEN_INSERT_ATTEMPTS');
    expect(actions).toContain("details?.supabaseErrorCode === '23505'");
    expect(actions).toContain("details.supabaseColumn === 'qr_token'");
    expect(actions).toContain("details.supabaseConstraint === 'employees_qr_token_key'");
    expect(actions).toMatch(/if \(!isQrTokenCollision \|\| attempt === EMPLOYEE_QR_TOKEN_INSERT_ATTEMPTS - 1\) break/);
  });

  it('keeps qr_token out of the browser contract, response selection, and persistence logs', () => {
    expect(parseEmployeeCreateRequest({
      fullName: 'Maker Lab', email: 'makerlab.marketing@gmail.com', title: 'Tester',
      department: 'X_NG_CH_NH_LUMINAL', phone: '', employmentStatus: 'ACTIVE',
      qr_token: 'browser-controlled-token',
    }).success).toBe(false);
    expect(actions).not.toMatch(/CREATE_EMPLOYEE_SELECT\s*=\s*[^\n]*qr_token/);
    expect(actions).not.toMatch(/console\.(?:error|warn|log)\([^)]*generateEmployeeQrToken/);
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
