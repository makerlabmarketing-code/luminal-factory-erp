import 'server-only';

import type { Facility } from '@/lib/types/facility';
import { createClient } from '@/utils/supabase/server';
import { loadFacilityDirectory } from '@/services/server/facilityDirectory';
import {
  canAccessAdmin,
  AuthFlowError,
  requireWorkspaceAccess,
  type ServerEmployee,
  toPublicStaffEmployee,
} from '@/services/server/auth';

export type StaffPortalErrorCode =
  | 'session_not_verified'
  | 'employee_not_connected'
  | 'employee_inactive'
  | 'staff_workspace_required'
  | 'attendance_lookup_failed'
  | 'facility_lookup_failed'
  | 'staff_portal_unavailable'
  | 'staff_portal_unhandled_failure';

export interface StaffPortalWarning {
  code: 'facility_lookup_failed';
  message: string;
  retryable: boolean;
  correlationId: string;
}

export interface StaffPortalErrorState {
  code: StaffPortalErrorCode;
  message: string;
  retryable: boolean;
  correlationId: string;
  action: 'login' | 'retry' | 'none';
}

export type StaffPortalLoadState =
  | {
      ok: true;
      employee: ReturnType<typeof toPublicStaffEmployee>;
      assignedBranch: Facility | null;
      capabilities: {
        canAccessAdmin: boolean;
        canAccessStaff: boolean;
      };
      warnings: StaffPortalWarning[];
    }
  | {
      ok: false;
      error: StaffPortalErrorState;
    };

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

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/gi, '[uuid]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .slice(0, 240);
}

function safeDetailsForLog(error: unknown) {
  if (error instanceof AuthFlowError) {
    return {
      code: error.code,
      failureStage: error.failureStage,
      status: error.status,
      supabaseErrorCode: error.safeDetails?.supabase_error_code || null,
    };
  }

  return {
    code: 'staff_portal_unhandled_failure',
    failureStage: 'unknown',
    message: sanitizeErrorMessage(error),
  };
}

function logStaffPortalBoundary(params: {
  correlationId: string;
  code: StaffPortalErrorCode;
  route: '/staff';
  authStage?: string | null;
  employeeStage?: string | null;
  workspaceStage?: string | null;
  attendanceStage?: string | null;
  facilityStage?: string | null;
  retryable: boolean;
  error?: unknown;
}) {
  console.error('[staff-portal]', {
    correlationId: params.correlationId,
    route: params.route,
    code: params.code,
    authStage: params.authStage || null,
    employeeStage: params.employeeStage || null,
    workspaceStage: params.workspaceStage || null,
    attendanceStage: params.attendanceStage || null,
    facilityStage: params.facilityStage || null,
    retryable: params.retryable,
    error: params.error ? safeDetailsForLog(params.error) : null,
  });
}

async function getMetadataBranches(): Promise<Facility[]> {
  const directory = await loadFacilityDirectory(await createClient());
  const facilities = directory.facilities;
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

function toStaffPortalErrorState(error: unknown, correlationId: string): StaffPortalErrorState {
  if (error instanceof AuthFlowError) {
    if (error.code === 'session_not_verified') {
      return {
        code: 'session_not_verified',
        message: 'Phiên đăng nhập chưa được xác nhận. Vui lòng đăng nhập lại.',
        retryable: false,
        correlationId,
        action: 'login',
      };
    }

    if (error.code === 'employee_not_linked') {
      return {
        code: 'employee_not_connected',
        message: 'Tài khoản chưa được liên kết với hồ sơ nhân sự.',
        retryable: false,
        correlationId,
        action: 'login',
      };
    }

    if (error.code === 'employee_inactive') {
      return {
        code: 'employee_inactive',
        message: 'Hồ sơ nhân sự hiện không hoạt động.',
        retryable: false,
        correlationId,
        action: 'none',
      };
    }

    if (error.code === 'workspace_forbidden') {
      return {
        code: 'staff_workspace_required',
        message: 'Tài khoản chưa được cấp quyền truy cập khu vực nhân viên.',
        retryable: false,
        correlationId,
        action: 'none',
      };
    }

    return {
      code: 'staff_portal_unavailable',
      message: 'Không thể tải khu vực nhân viên. Vui lòng thử lại.',
      retryable: error.status >= 500,
      correlationId,
      action: error.status >= 500 ? 'retry' : 'none',
    };
  }

  return {
    code: 'staff_portal_unhandled_failure',
    message: 'Không thể tải khu vực nhân viên. Vui lòng thử lại.',
    retryable: true,
    correlationId,
    action: 'retry',
  };
}

export async function getStaffPortalLoadState(): Promise<StaffPortalLoadState> {
  const correlationId = crypto.randomUUID();
  let authContext;

  try {
    authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
  } catch (error) {
    const errorState = toStaffPortalErrorState(error, correlationId);
    logStaffPortalBoundary({
      correlationId,
      route: '/staff',
      code: errorState.code,
      authStage: error instanceof AuthFlowError ? error.failureStage : 'unknown',
      employeeStage: error instanceof AuthFlowError && error.failureStage === 'employee_lookup' ? 'failed' : null,
      workspaceStage: error instanceof AuthFlowError && error.failureStage === 'workspace_access' ? 'failed' : null,
      retryable: errorState.retryable,
      error,
    });

    return { ok: false, error: errorState };
  }

  const warnings: StaffPortalWarning[] = [];
  let branches: Facility[] = [];

  try {
    branches = await getMetadataBranches();
  } catch (error) {
    const facilityCorrelationId = crypto.randomUUID();
    logStaffPortalBoundary({
      correlationId: facilityCorrelationId,
      route: '/staff',
      code: 'facility_lookup_failed',
      authStage: 'verified',
      employeeStage: 'resolved',
      workspaceStage: 'allowed',
      facilityStage: 'failed',
      retryable: true,
      error,
    });
    warnings.push({
      code: 'facility_lookup_failed',
      message: 'Không thể tải thông tin cơ sở làm việc. Dữ liệu chấm công vẫn có thể thử tải lại.',
      retryable: true,
      correlationId: facilityCorrelationId,
    });
  }

  const adminAccess = await canAccessAdmin(authContext);

  return {
    ok: true,
    employee: toPublicStaffEmployee(authContext.employee),
    assignedBranch: findAssignedBranch(authContext.employee, branches),
    capabilities: {
      canAccessAdmin: adminAccess.allowed,
      canAccessStaff: true,
    },
    warnings,
  };
}

export async function getAuthenticatedStaffPortalData() {
  const authContext = await requireWorkspaceAccess('STAFF_WORKSPACE');
  const branches = await getMetadataBranches();
  const adminAccess = await canAccessAdmin(authContext);

  return {
    employee: toPublicStaffEmployee(authContext.employee),
    assignedBranch: findAssignedBranch(authContext.employee, branches),
    capabilities: {
      canAccessAdmin: adminAccess.allowed,
      canAccessStaff: true,
    },
  };
}
