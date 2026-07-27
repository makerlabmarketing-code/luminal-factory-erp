import 'server-only';

import type { Facility } from '@/lib/types/facility';
import { getFacilityDirectory } from '@/services/server/facilityDirectory';
import {
  canAccessAdmin,
  canAccessStaff,
  requireWorkspaceAccess,
  type ServerEmployee,
  toPublicStaffEmployee,
} from '@/services/server/auth';

export function findAssignedBranch(
  employee: Pick<ServerEmployee, 'branch' | 'branch_code'>,
  branches: Facility[]
): Facility | null {
  const matchedBranch = branches.find((branch) => {
    if (branch.code && employee.branch_code && branch.code === employee.branch_code) return true;
    if (branch.name && employee.branch && branch.name === employee.branch) return true;
    if (branch.name && employee.branch_code && branch.name === employee.branch_code) return true;
    if (branch.facility_name && employee.branch_code && branch.facility_name === employee.branch_code) return true;

    return false;
  });

  return matchedBranch || null;
}

async function getMetadataBranches(): Promise<Facility[]> {
  const facilities = await getFacilityDirectory();
  return facilities.map((facility) => ({
    id: facility.id,
    code: facility.code,
    facility_name: facility.name,
    name: facility.name,
    lat: facility.lat,
    lng: facility.lng,
    radius: facility.radius,
    is_active: facility.isActive,
  }));
}

export async function getAuthenticatedStaffPortalData() {
  const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
  const [branches, adminAccess, staffAccess] = await Promise.all([
    getMetadataBranches(),
    canAccessAdmin(authContext),
    canAccessStaff(authContext),
  ]);

  return {
    employee: toPublicStaffEmployee(authContext.employee),
    assignedBranch: findAssignedBranch(authContext.employee, branches),
    capabilities: {
      canAccessAdmin: adminAccess.allowed,
      canAccessStaff: staffAccess.allowed,
    },
  };
}
