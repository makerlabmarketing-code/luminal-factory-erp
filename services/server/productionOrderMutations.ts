import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';
import {
  ARTISAN_KEYCAP_WORKFLOW_TEMPLATE,
} from '@/lib/production-order-workflow';
import {
  buildProductionOrderRpcPayload,
  parseProductionOrderCreateRequest,
  PRODUCTION_ORDER_MUTATIONS_FLAG,
  ProductionOrderCreateValidationError,
  type ProductionOrderCreateRequest,
} from '@/lib/production-order-create';
import type {
  ProductionOrderCreateContextResponse,
  ProductionOrderCreateMemberOption,
  ProductionOrderCreateProjectOption,
} from '@/lib/types/production-order-read';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';

type MutationBody = Record<string, unknown>;

interface ProjectRow {
  id?: unknown;
  project_code?: unknown;
  project_name?: unknown;
  status?: unknown;
}

interface EmployeeJoin {
  full_name?: unknown;
  title?: unknown;
  status?: unknown;
  is_active?: unknown;
}

interface MembershipRow {
  project_id?: unknown;
  employee_id?: unknown;
  role_code?: unknown;
  status?: unknown;
  employees?: EmployeeJoin | EmployeeJoin[] | null;
}

const CLOSED_PROJECT_STATUSES = new Set(['ARCHIVED', 'CANCELLED', 'COMPLETED']);
const PROJECT_ROLE_CODES = new Set(['PROJECT_OWNER', 'PROJECT_MANAGER', 'CREATIVE_LEAD', 'CONTRIBUTOR']);

function mutationError(
  status: number,
  message: string,
  failureStage: 'permission_check' | 'payload_validation' | 'unknown' = 'unknown',
  safeDetails?: Record<string, boolean | number | string | null>,
) {
  return new AuthFlowError({
    status,
    code: status === 403 ? 'permission_forbidden' : status === 422 ? 'payload_validation_failed' : 'service_unavailable',
    message,
    failureStage,
    safeDetails,
  });
}

export function isProductionOrderMutationEnabled(): boolean {
  return process.env[PRODUCTION_ORDER_MUTATIONS_FLAG] === 'true';
}

async function requireProductionOrderCreate() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const [canManageProjects, canManageTasks] = await Promise.all([
    hasPermission(authContext, 'PROJECT_MANAGE'),
    hasPermission(authContext, 'TASK_MANAGE'),
  ]);
  if (!canManageProjects || !canManageTasks) {
    throw mutationError(403, 'Bạn không có quyền tạo lệnh sản xuất.', 'permission_check');
  }
  if (!isProductionOrderMutationEnabled()) {
    throw mutationError(409, 'Chức năng tạo lệnh sản xuất đang chờ kích hoạt.', 'unknown', {
      runtime_flag_enabled: false,
    });
  }
}

function joinedEmployee(row: MembershipRow): EmployeeJoin {
  return Array.isArray(row.employees) ? row.employees[0] || {} : row.employees || {};
}

function activeMember(row: MembershipRow): ProductionOrderCreateMemberOption | null {
  const employee = joinedEmployee(row);
  const employeeStatus = String(employee.status || '').trim().toUpperCase();
  const roleCode = String(row.role_code || '').trim().toUpperCase();
  const employeeId = Number(row.employee_id);
  if (
    row.status !== 'ACTIVE'
    || employee.is_active === false
    || ['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'].includes(employeeStatus)
    || !Number.isInteger(employeeId)
    || !PROJECT_ROLE_CODES.has(roleCode)
  ) return null;

  return {
    employeeId,
    fullName: String(employee.full_name || `Nhân sự #${employeeId}`),
    title: typeof employee.title === 'string' && employee.title ? employee.title : null,
    roleCode: roleCode as ProductionOrderCreateMemberOption['roleCode'],
  };
}

function databaseError(error: PostgrestError) {
  return mutationError(503, 'Không thể tải dữ liệu tạo lệnh sản xuất. Vui lòng thử lại.', 'unknown', {
    supabase_error_code: error.code || 'unknown',
  });
}

async function loadProductionOrderCreateContext(): Promise<ProductionOrderCreateContextResponse> {
  const supabase = createSupabaseAdminClient();
  const [projectResult, membershipResult] = await Promise.all([
    supabase.from('projects').select('id, project_code, project_name, status').order('created_at', { ascending: false }),
    supabase
      .from('project_members')
      .select('project_id, employee_id, role_code, status, employees!project_members_employee_id_fkey(full_name, title, status, is_active)')
      .eq('status', 'ACTIVE'),
  ]);
  if (projectResult.error) throw databaseError(projectResult.error);
  if (membershipResult.error) throw databaseError(membershipResult.error);

  const membersByProject = new Map<number, ProductionOrderCreateMemberOption[]>();
  for (const row of (membershipResult.data || []) as MembershipRow[]) {
    const projectId = Number(row.project_id);
    const member = activeMember(row);
    if (!Number.isInteger(projectId) || !member) continue;
    membersByProject.set(projectId, [...(membersByProject.get(projectId) || []), member]);
  }

  const projects = ((projectResult.data || []) as ProjectRow[]).flatMap((row): ProductionOrderCreateProjectOption[] => {
    const projectId = Number(row.id);
    const status = String(row.status || '').trim().toUpperCase();
    if (!Number.isInteger(projectId) || CLOSED_PROJECT_STATUSES.has(status)) return [];
    return [{
      projectId,
      projectCode: String(row.project_code || ''),
      projectName: String(row.project_name || 'Dự án chưa đặt tên'),
      status,
      members: (membersByProject.get(projectId) || []).sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi')),
    }];
  });

  return {
    success: true,
    workflow: {
      name: ARTISAN_KEYCAP_WORKFLOW_TEMPLATE.name,
      stageCount: ARTISAN_KEYCAP_WORKFLOW_TEMPLATE.stages.length,
    },
    projects,
  };
}

export async function getProductionOrderCreateContext(): Promise<ProductionOrderCreateContextResponse> {
  await requireProductionOrderCreate();
  return loadProductionOrderCreateContext();
}

function assertProjectRoles(project: ProductionOrderCreateProjectOption, managerId: number, creativeLeadId: number) {
  const manager = project.members.find((member) => member.employeeId === managerId && member.roleCode === 'PROJECT_MANAGER');
  const creativeLead = project.members.find((member) => member.employeeId === creativeLeadId && member.roleCode === 'CREATIVE_LEAD');
  if (!manager) {
    throw mutationError(422, 'Quản lý đã chọn không còn là quản lý đang hoạt động của dự án.', 'payload_validation');
  }
  if (!creativeLead) {
    throw mutationError(422, 'Creative lead đã chọn không còn hoạt động trong dự án.', 'payload_validation');
  }
}

function mapRpcFailure(result: Record<string, unknown> | null): AuthFlowError {
  const code = typeof result?.code === 'string' ? result.code : 'production_order_create_failed';
  const message = typeof result?.message === 'string' ? result.message : 'Không thể tạo lệnh sản xuất đầy đủ.';
  const status = code === 'session_not_verified' ? 401
    : code === 'permission_forbidden' || code === 'actor_not_allowed' || code === 'project_not_allowed' ? 403
      : code === 'duplicate_production_code' ? 409
        : code === 'payload_validation_failed' || code === 'client_actor_rejected' ? 422
          : 503;
  return mutationError(status, message, status === 403 ? 'permission_check' : status === 422 ? 'payload_validation' : 'unknown', {
    rpc_code: code,
  });
}

export async function createProductionOrder(body: MutationBody): Promise<{ success: true; productionOrderId: string; productionCode: string }> {
  await requireProductionOrderCreate();
  let input: ProductionOrderCreateRequest;
  try {
    input = parseProductionOrderCreateRequest(body);
  } catch (error) {
    if (error instanceof ProductionOrderCreateValidationError) {
      throw mutationError(422, error.message, 'payload_validation', { field: error.field });
    }
    throw error;
  }

  const context = await loadProductionOrderCreateContext();
  const project = context.projects.find((candidate) => candidate.projectId === input.projectId);
  if (!project) throw mutationError(422, 'Dự án không hợp lệ hoặc đã đóng.', 'payload_validation');
  assertProjectRoles(project, input.projectManagerEmployeeId, input.creativeLeadEmployeeId);

  const payload = buildProductionOrderRpcPayload(input, project.members.map((member) => member.employeeId));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_production_order_atomic', { p_payload: payload });
  if (error) {
    throw mutationError(503, 'Không thể tạo lệnh sản xuất. Vui lòng thử lại.', 'unknown', {
      supabase_error_code: error.code || 'unknown',
    });
  }
  const result = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
  if (result?.success !== true) throw mapRpcFailure(result);
  const productionOrderId = typeof result.productionOrderId === 'string' ? result.productionOrderId : '';
  if (!productionOrderId) throw mutationError(503, 'Không thể xác nhận lệnh sản xuất đã tạo.');
  return { success: true, productionOrderId, productionCode: input.productionCode };
}
