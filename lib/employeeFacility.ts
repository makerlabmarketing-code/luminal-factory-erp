export type FacilityResolutionStatus =
  | 'resolved_by_id'
  | 'resolved_by_code'
  | 'resolved_by_name'
  | 'unassigned'
  | 'unresolved_legacy'
  | 'enrichment_failed';

export interface ResolvableFacility {
  id: string;
  code: string;
  name: string;
}

export interface EmployeeFacilityResolution {
  facilityId: string | null;
  facilityCode: string | null;
  facilityName: string | null;
  facilityDisplayName: string;
  facilityResolutionStatus: FacilityResolutionStatus;
  legacyValue: string | null;
}

const normalize = (value?: string | null) => (value || '').trim();
const comparable = (value?: string | null) => normalize(value).toLocaleLowerCase('vi');

export function resolveEmployeeFacility(
  employeeFacilityValue: string | null | undefined,
  facilities: readonly ResolvableFacility[],
  directoryAvailable = true
): EmployeeFacilityResolution {
  const legacyValue = normalize(employeeFacilityValue);

  if (!legacyValue) {
    return {
      facilityId: null,
      facilityCode: null,
      facilityName: null,
      facilityDisplayName: 'Chưa gán',
      facilityResolutionStatus: 'unassigned',
      legacyValue: null,
    };
  }

  if (!directoryAvailable) {
    return {
      facilityId: null,
      facilityCode: null,
      facilityName: null,
      facilityDisplayName: /^\d+$/.test(legacyValue) ? 'Cơ sở chưa xác định' : legacyValue,
      facilityResolutionStatus: 'enrichment_failed',
      legacyValue,
    };
  }

  const matchBy = (field: keyof ResolvableFacility) =>
    facilities.find((facility) => comparable(facility[field]) === comparable(legacyValue));
  const idMatch = matchBy('id');
  const codeMatch = idMatch ? undefined : matchBy('code');
  const nameMatch = idMatch || codeMatch ? undefined : matchBy('name');
  const matched = idMatch || codeMatch || nameMatch;

  if (matched) {
    return {
      facilityId: matched.id,
      facilityCode: normalize(matched.code) || null,
      facilityName: matched.name,
      facilityDisplayName: matched.name,
      facilityResolutionStatus: idMatch ? 'resolved_by_id' : codeMatch ? 'resolved_by_code' : 'resolved_by_name',
      legacyValue,
    };
  }

  return {
    facilityId: null,
    facilityCode: null,
    facilityName: null,
    facilityDisplayName: /^\d+$/.test(legacyValue) ? 'Cơ sở chưa xác định' : legacyValue,
    facilityResolutionStatus: 'unresolved_legacy',
    legacyValue,
  };
}
