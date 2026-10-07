import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => vi.unstubAllEnvs());

  it('uses the verified actor and atomic RPC when history is enabled', async () => {
    vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED', 'true');
    const fake = client();
    const rpc = vi.fn(async () => ({ error: null }));
    const trace = { requestReachedSupabase: false, rowUpdated: false };
    await persistAdminEmployee({ ...fake.supabase, rpc } as never, '3', { phone: '0901234567' }, trace, '7');
    expect(rpc).toHaveBeenCalledWith('update_erp_record_with_history', {
      p_entity: 'employee', p_id: '3', p_patch: { phone: '0901234567' }, p_actor_id: '7', p_reason: null,
    });
    expect(fake.update).not.toHaveBeenCalled();
    expect(trace.rowUpdated).toBe(true);
  });

  it('never falls back to an unaudited update after an audit failure or missing actor', async () => {
    vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED', 'true');
    const fake = client();
    const rpc = vi.fn(async () => ({ error: { code: '23514' } }));
    const trace = { requestReachedSupabase: false, rowUpdated: false };
    await expect(persistAdminEmployee({ ...fake.supabase, rpc } as never, '3', { phone: '0901234567' }, trace, '7'))
      .rejects.toMatchObject({ failureStage: 'core_mutation' });
    expect(trace.rowUpdated).toBe(false);
    await expect(persistAdminEmployee({ ...fake.supabase, rpc } as never, '3', { phone: '0901234567' }, trace))
      .rejects.toMatchObject({ failureStage: 'query_construction' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(fake.update).not.toHaveBeenCalled();
  });

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
    expect(sanitizeAdminMutationFailure({ code: '23502', message: 'null value in column "phone" violates not-null constraint' })).toMatchObject({
      supabaseErrorCode: '23502', supabaseColumn: 'phone',
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
