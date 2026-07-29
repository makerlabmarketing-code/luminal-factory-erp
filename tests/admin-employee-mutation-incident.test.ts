import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { persistAdminEmployee, sanitizeAdminMutationFailure } from '../services/server/adminEmployeePersistence';
import { AdminClientError } from '../utils/supabase/admin';

function client(params: { mutation?: unknown; mutationThrow?: unknown; readback?: unknown; readbackThrow?: unknown } = {}) {
  const eq = vi.fn(() => ({ then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
    params.mutationThrow === undefined ? resolve(params.mutation ?? { error: null }) : reject(params.mutationThrow);
  } }));
  const update = vi.fn(() => ({ eq }));
  const maybeSingle = vi.fn(async () => {
    if (params.readbackThrow !== undefined) throw params.readbackThrow;
    return params.readback ?? { data: { id: 3, phone: '+84901234567' }, error: null };
  });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  return { supabase: { from: vi.fn(() => ({ update, select })) }, update, eq };
}

describe('admin employee production mutation diagnostics', () => {
  it('sends only the normalized phone column and targets only employee 3', async () => {
    const fake = client();
    const trace = { requestReachedSupabase: false, rowUpdated: false };
    await persistAdminEmployee(fake.supabase as never, '3', { phone: '+84901234567' }, trace);
    expect(fake.update).toHaveBeenCalledWith({ phone: '+84901234567' });
    expect(fake.eq).toHaveBeenCalledWith('id', '3');
    expect(trace).toEqual({ requestReachedSupabase: true, rowUpdated: true });
    const databaseUpdate = (fake.update as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0];
    for (const key of ['fullName', 'employmentStatus', 'department', 'facility', 'permissions']) {
      expect(databaseUpdate).not.toHaveProperty(key);
    }
  });

  it('preserves PostgREST codes and sanitizes thrown values', () => {
    expect(sanitizeAdminMutationFailure({ code: '42703', status: 400, message: 'column missing' })).toMatchObject({
      supabaseErrorCode: '42703', httpStatus: 400, errorCategory: 'schema_contract',
    });
    expect(sanitizeAdminMutationFailure(new TypeError('fetch failed https://secret.example/token'))).toMatchObject({
      exceptionName: 'TypeError', errorCategory: 'network',
    });
    expect(JSON.stringify(sanitizeAdminMutationFailure('secret payload value'))).not.toContain('secret payload value');
  });

  it('keeps mutation success when core readback returns or throws an error', async () => {
    for (const fake of [client({ readback: { data: null, error: { code: '42501' } } }), client({ readbackThrow: new Error('network') })]) {
      const trace = { requestReachedSupabase: false, rowUpdated: false };
      const result = await persistAdminEmployee(fake.supabase as never, '3', { phone: '0901234567' }, trace);
      expect(result.data).toBeNull();
      expect(result.readbackError).toBeTruthy();
      expect(trace.rowUpdated).toBe(true);
    }
  });

  it('distinguishes query construction from a returned or thrown core mutation failure', async () => {
    const returned = client({ mutation: { error: { code: '42501' } } });
    await expect(persistAdminEmployee(returned.supabase as never, '3', { phone: '0901234567' }, { requestReachedSupabase: false, rowUpdated: false }))
      .rejects.toMatchObject({ failureStage: 'core_mutation' });
    const thrown = client({ mutationThrow: 'network unavailable' });
    await expect(persistAdminEmployee(thrown.supabase as never, '3', { phone: '0901234567' }, { requestReachedSupabase: false, rowUpdated: false }))
      .rejects.toMatchObject({ failureStage: 'core_mutation' });
  });

  it('uses a distinct configuration error for a missing privileged key', () => {
    expect(new AdminClientError('admin_client_configuration_failed')).toMatchObject({ code: 'admin_client_configuration_failed' });
  });
});
