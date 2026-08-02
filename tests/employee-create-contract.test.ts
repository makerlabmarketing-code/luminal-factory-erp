import { describe, expect, it } from 'vitest';
import { parseEmployeeCreateRequest } from '../lib/employeeCreateContract';

const luminalQaPayload = {
  fullName: 'LuminalQA',
  email: 'makerlab.marketing@gmail.com',
  title: '',
  department: 'CN1',
  phone: '',
  employmentStatus: 'ACTIVE',
};

describe('employee create request contract', () => {
  it('accepts the exact Admin UI payload and normalizes stable values', () => {
    expect(parseEmployeeCreateRequest(luminalQaPayload)).toEqual({
      success: true,
      data: luminalQaPayload,
    });
  });

  it('accepts nullable optional fields from compatible clients', () => {
    expect(parseEmployeeCreateRequest({ ...luminalQaPayload, phone: null, title: null })).toEqual({
      success: true,
      data: luminalQaPayload,
    });
  });

  it('returns all safe field errors before persistence for invalid payloads', () => {
    const result = parseEmployeeCreateRequest({
      ...luminalQaPayload,
      fullName: '',
      email: 'not-an-email',
      employmentStatus: 'Đang làm',
      unsupported: true,
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: expect.objectContaining({
        fullName: expect.any(String),
        email: expect.any(String),
        employmentStatus: expect.any(String),
        form: expect.any(String),
      }),
    });
  });

  it('rejects unknown fields without inventing values', () => {
    const result = parseEmployeeCreateRequest({
      ...luminalQaPayload,
      department: 'Xưởng chính Luminal',
      facilityId: '1',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.form).toBeTruthy();
  });
});
