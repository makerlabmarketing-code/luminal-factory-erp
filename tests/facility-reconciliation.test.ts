import { describe, expect, it } from 'vitest';
import { mergeFacilityRefetch, reconcileCreatedFacility, reconcileDeletedFacility, reconcileUpdatedFacility } from '../lib/facilityReconciliation';

const rows: Array<{ id: number | string; name: string }> = [{ id: 1, name: 'Một' }, { id: 2, name: 'Hai' }];

describe('facility list reconciliation', () => {
  it('replaces only the stable matching id immediately', () => {
    expect(reconcileUpdatedFacility(rows, { id: '2', name: 'Hai mới' })).toEqual([{ id: 1, name: 'Một' }, { id: '2', name: 'Hai mới' }]);
  });

  it('prepends a returned create without duplicating its id', () => {
    expect(reconcileCreatedFacility(rows, { id: 2, name: 'Hai mới' })).toEqual([{ id: 2, name: 'Hai mới' }, { id: 1, name: 'Một' }]);
  });

  it('removes the returned deleted id immediately', () => {
    expect(reconcileDeletedFacility(rows, '1')).toEqual([{ id: 2, name: 'Hai' }]);
  });

  it('does not let a stale background result revert a confirmed row', () => {
    const local = reconcileUpdatedFacility(rows, { id: 2, name: 'Hai mới' });
    expect(mergeFacilityRefetch(local, rows, new Set(['2']))).toEqual(local);
  });
});
