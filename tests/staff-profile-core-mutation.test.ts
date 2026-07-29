import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AdminClientError, createSupabaseAdminClient, getSupabaseAdminKey } from '../utils/supabase/admin';
import {
  buildStaffProfileDatabaseUpdate,
  persistStaffProfile,
  sanitizePersistenceFailure,
  type MutationTrace,
} from '../services/server/staffProfilePersistence';
import { resolveEmployeeFacility } from '../lib/employeeFacility';

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });
const trace = (): MutationTrace => ({ clientCreationCompleted: true, updateBuilderCreated: false, networkExecutionBegan: false, resultErrorReturned: false, readbackBegan: false });

function clientWith(params: { mutation?: unknown; mutationThrow?: unknown; readback?: unknown; readbackThrow?: unknown }) {
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) { params.mutationThrow === undefined ? resolve(params.mutation ?? { error: null }) : reject(params.mutationThrow); } })) }));
  const maybeSingle = vi.fn(async () => {
    if (params.readbackThrow !== undefined) throw params.readbackThrow;
    return params.readback ?? { data: { phone: '1', bank_name: 'MB', bank_account_number: '2' }, error: null };
  });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  return { client: { from: vi.fn(() => ({ update, select })) }, update };
}

describe('staff profile privileged client contract', () => {
  it('rejects missing and public keys before client construction', () => {
    process.env.SUPABASE_SECRET_KEY = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    expect(() => getSupabaseAdminKey()).toThrowError(expect.objectContaining({ code: 'admin_client_configuration_failed' }));
    process.env.SUPABASE_SECRET_KEY = 'sb_publishable_not_privileged';
    expect(() => getSupabaseAdminKey()).toThrowError(expect.objectContaining({ code: 'admin_client_configuration_failed' }));
  });

  it('classifies factory exceptions as client creation failures', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_server';
    expect(() => createSupabaseAdminClient((() => { throw new Error('factory'); }) as never))
      .toThrowError(expect.objectContaining<Partial<AdminClientError>>({ code: 'admin_client_creation_failed' }));
  });
});

describe('staff profile mutation contract', () => {
  it('resolves legacy numeric facility id 3 to the authoritative label', () => {
    const facility = resolveEmployeeFacility('3', [{ id: '3', code: 'HCM', name: 'Xưởng Hồ Chí Minh' }]);
    expect(facility.facilityDisplayName).toBe('Xưởng Hồ Chí Minh');
  });
  it('maps only confirmed snake_case columns', () => {
    const payload = buildStaffProfileDatabaseUpdate({ phone: ' 1 ', bankName: ' MB ', bankAccountNumber: ' 2 ' }, (value) => String(value).trim());
    expect(payload).toEqual({ phone: '1', bank_name: 'MB', bank_account_number: '2' });
    expect(payload).not.toHaveProperty('bankName');
    expect(payload).not.toHaveProperty('bankAccountNumber');
  });

  it('preserves PostgREST codes and classifies Error, object, and string throws without leaking messages', () => {
    expect(sanitizePersistenceFailure({ code: '42703', details: 'column missing', hint: 'schema' })).toMatchObject({ supabaseErrorCode: '42703', supabaseDetailsCategory: 'schema_contract' });
    expect(sanitizePersistenceFailure(new TypeError('fetch failed https://secret'))).toMatchObject({ exceptionName: 'TypeError', messageCategory: 'network' });
    expect(sanitizePersistenceFailure({ message: 'Invalid URL https://secret' })).toMatchObject({ exceptionName: 'Object', messageCategory: 'invalid_url' });
    expect(sanitizePersistenceFailure('socket unavailable')).toMatchObject({ exceptionName: 'StringException', messageCategory: 'network' });
    expect(JSON.stringify(sanitizePersistenceFailure(new Error('SERVICE_ROLE_SECRET_VALUE')))).not.toContain('SERVICE_ROLE_SECRET_VALUE');
  });

  it('targets one employee and sends the exact payload to update', async () => {
    const fake = clientWith({});
    const payload = { phone: '1', bank_name: 'MB', bank_account_number: '2' };
    await persistStaffProfile(fake.client as never, 3, payload, trace());
    expect(fake.client.from).toHaveBeenCalledWith('employees');
    expect(fake.update).toHaveBeenCalledWith(payload);
  });

  it('distinguishes returned and thrown mutation failures from readback warnings', async () => {
    const returned = clientWith({ mutation: { error: { code: '42501', message: 'denied' } } });
    const returnedTrace = trace();
    await expect(persistStaffProfile(returned.client as never, 3, { phone: '1' }, returnedTrace)).rejects.toMatchObject({ code: 'employee_core_mutation_failed' });
    expect(returnedTrace).toMatchObject({ resultErrorReturned: true, networkExecutionBegan: true, readbackBegan: false });

    const thrown = clientWith({ mutationThrow: 'network down' });
    await expect(persistStaffProfile(thrown.client as never, 3, { phone: '1' }, trace())).rejects.toMatchObject({ code: 'employee_core_mutation_failed' });

    const readback = clientWith({ readback: { data: null, error: { code: '42501' } } });
    await expect(persistStaffProfile(readback.client as never, 3, { phone: '1' }, trace())).resolves.toMatchObject({ data: null, readbackError: { code: '42501' } });
  });
});
