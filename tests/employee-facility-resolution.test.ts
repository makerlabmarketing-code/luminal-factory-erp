import { describe, expect, it } from 'vitest';
import { resolveEmployeeFacility } from '../lib/employeeFacility';

const facilities = [
  { id: '1', code: 'CN1', name: 'Chi nhánh trung tâm' },
  { id: '3', code: 'XUONG_3', name: 'Xưởng số 3' },
];

describe('employee facility compatibility resolver', () => {
  it('resolves a numeric facility id without exposing the raw id', () => {
    const result = resolveEmployeeFacility('3', facilities);
    expect(result).toMatchObject({ facilityId: '3', facilityDisplayName: 'Xưởng số 3', facilityResolutionStatus: 'resolved_by_id' });
    expect(result.facilityDisplayName).not.toBe('3');
  });

  it('resolves a stable facility code to its name', () => {
    expect(resolveEmployeeFacility('cn1', facilities)).toMatchObject({ facilityId: '1', facilityCode: 'CN1', facilityDisplayName: 'Chi nhánh trung tâm', facilityResolutionStatus: 'resolved_by_code' });
  });

  it('preserves unresolved text with a warning status', () => {
    expect(resolveEmployeeFacility('Cơ sở cũ', facilities)).toMatchObject({ facilityDisplayName: 'Cơ sở cũ', legacyValue: 'Cơ sở cũ', facilityResolutionStatus: 'unresolved_legacy' });
  });

  it('renders a genuinely empty assignment as Chưa gán', () => {
    expect(resolveEmployeeFacility(null, facilities)).toMatchObject({ facilityDisplayName: 'Chưa gán', facilityResolutionStatus: 'unassigned' });
  });

  it('does not expose an unresolved numeric foreign key', () => {
    const result = resolveEmployeeFacility('99', facilities);
    expect(result.facilityDisplayName).toBe('Cơ sở chưa xác định');
    expect(result.legacyValue).toBe('99');
  });

  it('keeps core display safe when directory enrichment fails', () => {
    expect(resolveEmployeeFacility('CN1', [], false)).toMatchObject({ facilityDisplayName: 'CN1', facilityResolutionStatus: 'enrichment_failed' });
  });
});
