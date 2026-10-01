import { describe, expect, it } from 'vitest';
import { createCommerceMutationRetry } from '../lib/commerce-admin/mutation-retry';

describe('Commerce mutation retry identity', () => {
  const path = '/api/admin/commerce/homepage-hero';
  const body = { draft: { name: 'Hero nháp', modelStoragePath: 'models/hero.glb' } };

  it('reuses the operation after a lost response and allocates a new one after success', () => {
    const retry = createCommerceMutationRetry();
    const operation = retry.prepare(path, 'POST', body);
    expect(retry.prepare(path, 'POST', structuredClone(body))).toBe(operation);
    retry.confirm(operation);
    expect(retry.prepare(path, 'POST', body)).not.toBe(operation);
  });

  it('never reuses an operation for edited content, another target or another action', () => {
    const retry = createCommerceMutationRetry();
    const ids = [
      retry.prepare(path, 'POST', body),
      retry.prepare(path, 'POST', { draft: { ...body.draft, name: 'Hero khác' } }),
      retry.prepare(path + '/other', 'POST', body),
      retry.prepare(path + '/other', 'PATCH', body),
      retry.prepare(path + '/other/publish', 'POST', {}),
      retry.prepare(path + '/other/unpublish', 'POST', {}),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not let a stale success clear the current pending operation', () => {
    const retry = createCommerceMutationRetry();
    const old = retry.prepare(path, 'POST', body);
    const current = retry.prepare(path, 'POST', { draft: { ...body.draft, name: 'Mới' } });
    retry.confirm(old);
    expect(retry.prepare(path, 'POST', { draft: { ...body.draft, name: 'Mới' } })).toBe(current);
  });
});
